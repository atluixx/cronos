import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import { verifyToken } from "../middleware/auth.js";
import { registerSocket } from "./hub.js";

export function attachWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (socket, request) => {
    const url = new URL(request.url ?? "", "http://localhost");
    const token = url.searchParams.get("token") ?? "";
    const userId = verifyToken(token);

    if (!userId) {
      socket.close(4001, "Unauthorized");
      return;
    }

    registerSocket(userId, socket);
  });

  return wss;
}
