import type { WebSocket } from "ws";

const userSockets = new Map<string, Set<WebSocket>>();

export function registerSocket(userId: string, socket: WebSocket) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId)!.add(socket);
  socket.on("close", () => {
    userSockets.get(userId)?.delete(socket);
  });
}

export function broadcastToUser(userId: string, event: string, payload: unknown) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const message = JSON.stringify({ event, payload });
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(message);
  }
}
