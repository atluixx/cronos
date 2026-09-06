import { Prisma } from "@prisma/client";
import { BufferJSON, initAuthCreds, proto } from "@whiskeysockets/baileys";
import type { AuthenticationCreds, SignalDataTypeMap } from "@whiskeysockets/baileys";
import { prisma } from "../lib/prisma.js";

interface StoredAuthState {
  creds: AuthenticationCreds;
  keys: Record<string, Record<string, unknown>>;
}

function serialize(value: unknown): string {
  return JSON.stringify(value, BufferJSON.replacer);
}

function deserialize<T>(value: string): T {
  return JSON.parse(value, BufferJSON.reviver) as T;
}

/**
 * A Baileys auth-state implementation backed by the WhatsAppSession.authState column,
 * following the same shape as the reference useMultiFileAuthState, so each linked
 * number's creds/signal keys are isolated per DB row instead of per folder.
 */
export async function usePrismaAuthState(sessionId: string) {
  const row = await prisma.whatsAppSession.findUniqueOrThrow({ where: { id: sessionId } });

  const stored: StoredAuthState = row.authState
    ? deserialize<StoredAuthState>(JSON.stringify(row.authState))
    : { creds: initAuthCreds(), keys: {} };

  const persist = async () => {
    await prisma.whatsAppSession.update({
      where: { id: sessionId },
      data: { authState: JSON.parse(serialize(stored)) },
    });
  };

  return {
    state: {
      creds: stored.creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[],
        ): Promise<Record<string, SignalDataTypeMap[T]>> => {
          const result: Record<string, SignalDataTypeMap[T]> = {};
          for (const id of ids) {
            let value = stored.keys[type]?.[id];
            if (type === "app-state-sync-key" && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value as object);
            }
            if (value !== undefined) result[id] = value as SignalDataTypeMap[T];
          }
          return result;
        },
        set: async (data: { [T in keyof SignalDataTypeMap]?: Record<string, SignalDataTypeMap[T] | null> }) => {
          for (const category of Object.keys(data) as (keyof SignalDataTypeMap)[]) {
            stored.keys[category] ??= {};
            const entries = data[category] ?? {};
            for (const id of Object.keys(entries)) {
              const value = entries[id];
              if (value === null || value === undefined) {
                delete stored.keys[category][id];
              } else {
                stored.keys[category][id] = value;
              }
            }
          }
          await persist();
        },
      },
    },
    saveCreds: persist,
  };
}

export async function clearAuthState(sessionId: string) {
  await prisma.whatsAppSession.update({
    where: { id: sessionId },
    data: { authState: Prisma.JsonNull },
  });
}
