import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { broadcastToUser } from "../ws/hub.js";
import { usePrismaAuthState, clearAuthState } from "./prismaAuthState.js";
import type { SessionStatus } from "@prisma/client";

interface ActiveSession {
  socket: WASocket;
  userId: string;
  reconnectAttempts: number;
}

const activeSessions = new Map<string, ActiveSession>();
const MAX_RECONNECT_ATTEMPTS = 5;

// fetchLatestBaileysVersion() hits a remote endpoint; calling it on every single
// "Add Number" click was adding avoidable network latency before the socket
// (and therefore the QR) could even start. Cache it for a while instead.
const VERSION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cachedVersion: { version: [number, number, number]; fetchedAt: number } | null = null;

async function getWaVersion() {
  if (cachedVersion && Date.now() - cachedVersion.fetchedAt < VERSION_CACHE_TTL_MS) {
    return cachedVersion.version;
  }
  const t0 = Date.now();
  const { version } = await fetchLatestBaileysVersion();
  logger.info({ ms: Date.now() - t0 }, "[timing] fetchLatestBaileysVersion");
  cachedVersion = { version, fetchedAt: Date.now() };
  return version;
}

async function setStatus(sessionId: string, userId: string, status: SessionStatus, extra: { phoneNumber?: string } = {}) {
  await prisma.whatsAppSession.update({
    where: { id: sessionId },
    data: {
      status,
      ...(extra.phoneNumber ? { phoneNumber: extra.phoneNumber } : {}),
      ...(status === "CONNECTED" ? { lastConnectedAt: new Date() } : {}),
    },
  });
  broadcastToUser(userId, "session:status", { sessionId, status });
}

async function getCachedGroupMetadata(sessionId: string, jid: string) {
  const group = await prisma.group.findFirst({ where: { sessionId, whatsappGroupId: jid } });
  return group ? (group.cachedMetadata as any) : undefined;
}

export async function startSession(
  sessionId: string,
  userId: string,
  opts: { method: "qr" | "pairing"; phoneNumber?: string },
) {
  if (activeSessions.has(sessionId)) {
    return; // already starting/running
  }

  const t0 = Date.now();
  const { state, saveCreds } = await usePrismaAuthState(sessionId);
  const version = await getWaVersion();

  const socket = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    cachedGroupMetadata: (jid) => getCachedGroupMetadata(sessionId, jid),
  });
  logger.info({ sessionId, ms: Date.now() - t0 }, "[timing] socket created, awaiting handshake/QR");

  activeSessions.set(sessionId, { socket, userId, reconnectAttempts: 0 });

  if (opts.method === "pairing" && opts.phoneNumber && !socket.authState.creds.registered) {
    await setStatus(sessionId, userId, "AWAITING_CODE");
    const code = await socket.requestPairingCode(opts.phoneNumber.replace(/[^0-9]/g, ""));
    broadcastToUser(userId, "session:pairing-code", { sessionId, code });
  }

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && opts.method === "qr") {
      logger.info({ sessionId, ms: Date.now() - t0 }, "[timing] qr received from Baileys, broadcasting raw string");
      await setStatus(sessionId, userId, "AWAITING_SCAN");
      // Send the raw QR string, not a server-rendered raster image: the frontend
      // renders it client-side as SVG (larger, sharper, and skips a PNG-encode round trip).
      broadcastToUser(userId, "session:qr", { sessionId, qr });
    }

    if (connection === "open") {
      const entry = activeSessions.get(sessionId);
      if (entry) entry.reconnectAttempts = 0;
      const phoneNumber = socket.user?.id?.split(":")[0];
      await setStatus(sessionId, userId, "CONNECTED", { phoneNumber });
      logger.info({ sessionId }, "WhatsApp session connected");
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
        ?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        activeSessions.delete(sessionId);
        await clearAuthState(sessionId);
        await setStatus(sessionId, userId, "EXPIRED");
        return;
      }

      const entry = activeSessions.get(sessionId);
      const attempts = entry?.reconnectAttempts ?? 0;
      activeSessions.delete(sessionId);

      if (attempts >= MAX_RECONNECT_ATTEMPTS) {
        await setStatus(sessionId, userId, "EXPIRED");
        return;
      }

      await setStatus(sessionId, userId, "DISCONNECTED");
      setTimeout(() => {
        void startSession(sessionId, userId, { method: "qr" }).then(() => {
          const next = activeSessions.get(sessionId);
          if (next) next.reconnectAttempts = attempts + 1;
        });
      }, 2000 * (attempts + 1));
    }
  });
}

export function getSocket(sessionId: string): WASocket | undefined {
  return activeSessions.get(sessionId)?.socket;
}

export async function stopSession(sessionId: string) {
  const entry = activeSessions.get(sessionId);
  if (entry) {
    entry.socket.end(undefined);
    activeSessions.delete(sessionId);
  }
  await clearAuthState(sessionId);
}

/**
 * Used when the user explicitly unlinks a number: properly logs the device out
 * of WhatsApp (so it disappears from "Linked Devices" on the phone too) rather
 * than just dropping the local socket, then clears the local auth state.
 */
export async function logoutSession(sessionId: string) {
  const entry = activeSessions.get(sessionId);
  if (entry) {
    try {
      await entry.socket.logout();
    } catch (err) {
      logger.warn({ sessionId, err }, "socket.logout() failed, cleaning up locally anyway");
    }
    activeSessions.delete(sessionId);
  }
  await clearAuthState(sessionId);
}

export async function refreshGroups(sessionId: string) {
  const socket = getSocket(sessionId);
  if (!socket) throw new Error("Session is not connected");

  const metadataMap = await socket.groupFetchAllParticipating();

  for (const jid of Object.keys(metadataMap)) {
    const metadata = metadataMap[jid];
    await prisma.group.upsert({
      where: { sessionId_whatsappGroupId: { sessionId, whatsappGroupId: jid } },
      create: {
        sessionId,
        whatsappGroupId: jid,
        name: metadata.subject,
        participantCount: metadata.participants.length,
        cachedMetadata: metadata as any,
      },
      update: {
        name: metadata.subject,
        participantCount: metadata.participants.length,
        cachedMetadata: metadata as any,
        lastSyncedAt: new Date(),
      },
    });
  }

  return prisma.group.findMany({ where: { sessionId } });
}

// Restores every previously-linked session's Baileys socket on server boot.
// Without this, a restart drops the in-memory connection but leaves the DB
// status looking "CONNECTED" (stale) with nothing actually listening — the
// dashboard's "reconnects automatically" promise otherwise only applies to
// scheduled jobs, not the WhatsApp session itself.
export async function reconcileWhatsAppSessions(): Promise<number> {
  const sessions = await prisma.whatsAppSession.findMany({
    where: {
      removedAt: null,
      // These four states are only reachable after at least one link attempt,
      // meaning real (possibly still-valid) auth creds exist to resume from.
      // AWAITING_LINK (never linked) and EXPIRED (creds cleared) are skipped.
      status: { in: ["CONNECTED", "DISCONNECTED", "AWAITING_SCAN", "AWAITING_CODE"] },
    },
    select: { id: true, userId: true },
  });

  for (const session of sessions) {
    try {
      await startSession(session.id, session.userId, { method: "qr" });
    } catch (err) {
      logger.error({ sessionId: session.id, err }, "Failed to restore WhatsApp session on boot");
    }
  }

  return sessions.length;
}

export function isSessionActive(sessionId: string): boolean {
  return activeSessions.has(sessionId);
}
