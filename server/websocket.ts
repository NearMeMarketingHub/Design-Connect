import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

export interface RealtimeEvent {
  type: "messages" | "project" | "changeorder" | "estimate" | "invoice";
  projectId?: string;
  companyId?: string;
}

const clients = new Set<WebSocket>();

export function setupWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const url = request.url?.split("?")[0];
    if (url !== "/ws") {
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    clients.add(ws);

    ws.on("close", () => {
      clients.delete(ws);
    });

    ws.on("error", () => {
      clients.delete(ws);
    });
  });

  wss.on("error", (err) => {
    console.error("[WebSocket] Server error:", err);
  });
}

export function broadcast(event: RealtimeEvent): void {
  const payload = JSON.stringify(event);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
      } catch {
        clients.delete(ws);
      }
    }
  }
}
