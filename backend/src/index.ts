import "dotenv/config";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import "express-async-errors";
import cors from "cors";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { authRouter } from "./routes/auth.js";
import { sessionsRouter } from "./routes/sessions.js";
import { scheduledMessagesRouter } from "./routes/scheduledMessages.js";
import { mediaRouter } from "./routes/media.js";
import { templatesRouter } from "./routes/templates.js";
import { metricsRouter } from "./routes/metrics.js";
import { attachWebSocketServer } from "./ws/server.js";
import { reconcileScheduledJobs } from "./scheduler/reconcile.js";
import { refreshGroups, isSessionActive, reconcileWhatsAppSessions } from "./whatsapp/sessionManager.js";
import "./scheduler/worker.js"; // starts the BullMQ worker as a side effect

const app = express();
app.use(cors());
app.use(express.json());

// Uploaded attachments (template previews, composer thumbnails) — filenames
// are random tokens, not guessable, so unauthenticated static serving is
// consistent with the rest of this prototype's risk model.
app.use("/media", express.static(process.env.MEDIA_DIR ?? "./media"));

app.use("/api/auth", authRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/scheduled-messages", scheduledMessagesRouter);
app.use("/api/media", mediaRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/metrics", metricsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// In the Docker image, the built frontend is copied next to dist/ as ../public.
const staticDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get(/^(?!\/(api|ws)).*/, (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

// Safety net: a bad request (e.g. a delete blocked by a FK constraint) must
// never take down the whole process and every other user's live connections.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled request error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

process.on("unhandledRejection", (err) => {
  logger.error({ err }, "Unhandled rejection outside a request (e.g. Baileys event or job worker)");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
});

const server = http.createServer(app);
attachWebSocketServer(server);

const GROUP_METADATA_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function refreshAllConnectedSessionGroups() {
  const sessions = await prisma.whatsAppSession.findMany({ where: { status: "CONNECTED" } });
  for (const session of sessions) {
    if (!isSessionActive(session.id)) continue;
    try {
      await refreshGroups(session.id);
    } catch (err) {
      logger.warn({ sessionId: session.id, err }, "Periodic group refresh failed");
    }
  }
}

const PORT = Number(process.env.PORT ?? 4000);

server.listen(PORT, async () => {
  logger.info({ port: PORT }, "Server listening");
  await reconcileScheduledJobs();
  const restored = await reconcileWhatsAppSessions();
  logger.info({ count: restored }, "Reconciled WhatsApp sessions on boot");
  setInterval(() => void refreshAllConnectedSessionGroups(), GROUP_METADATA_REFRESH_INTERVAL_MS);
});
