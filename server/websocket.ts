import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import { createHmac, timingSafeEqual } from "crypto";
import pg from "pg";

export interface RealtimeEvent {
  type: "messages" | "project" | "changeorder" | "estimate" | "invoice";
  projectId?: string;
  companyId?: string | null;
  clientUserId?: string | null;
}

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  companyId: string | null;
}

const clients = new Set<ConnectedClient>();

function parseCookies(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    result[key] = decodeURIComponent(val);
  }
  return result;
}

function cookieUnsign(val: string, secret: string): string | false {
  const lastDot = val.lastIndexOf(".");
  if (lastDot < 0) return false;
  const str = val.slice(0, lastDot);
  const sig = val.slice(lastDot + 1);
  const expected = createHmac("sha256", secret)
    .update(str)
    .digest("base64")
    .replace(/=+$/, "");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf) ? str : false;
}

async function resolveSession(
  request: IncomingMessage,
  pool: pg.Pool,
  secret: string
): Promise<{ userId: string; companyId: string | null } | null> {
  try {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return null;

    const cookies = parseCookies(cookieHeader);
    const rawSid = cookies["connect.sid"];
    if (!rawSid) return null;

    const signed = rawSid.startsWith("s:") ? rawSid.slice(2) : rawSid;
    const unsigned = cookieUnsign(signed, secret);
    if (!unsigned) return null;

    const sessionResult = await pool.query<{ sess: Record<string, unknown> }>(
      "SELECT sess FROM session WHERE sid = $1",
      [unsigned]
    );
    if (!sessionResult.rows.length) return null;

    const sess = sessionResult.rows[0].sess as { passport?: { user?: string } };
    const userId = sess?.passport?.user;
    if (!userId) return null;

    const userResult = await pool.query<{ id: string; companyId: string | null }>(
      `SELECT id, "companyId" FROM users WHERE id = $1`,
      [userId]
    );
    if (!userResult.rows.length) return null;

    return {
      userId: userResult.rows[0].id,
      companyId: userResult.rows[0].companyId,
    };
  } catch {
    return null;
  }
}

export function setupWebSocket(httpServer: Server): void {
  const secret =
    process.env.SESSION_SECRET || "buildvision-secret-key-change-in-production";
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", async (request, socket, head) => {
    const url = request.url?.split("?")[0];
    if (url !== "/ws") {
      return;
    }

    const identity = await resolveSession(request, pool, secret);
    if (!identity) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const client: ConnectedClient = {
        ws,
        userId: identity.userId,
        companyId: identity.companyId,
      };
      clients.add(client);

      ws.on("close", () => clients.delete(client));
      ws.on("error", () => clients.delete(client));
    });
  });

  wss.on("error", (err) => {
    console.error("[WebSocket] Server error:", err);
  });
}

export function broadcast(event: RealtimeEvent): void {
  const payload = JSON.stringify(event);
  for (const client of Array.from(clients)) {
    if (client.ws.readyState !== WebSocket.OPEN) continue;
    const allowed =
      (event.companyId != null && client.companyId === event.companyId) ||
      (event.clientUserId != null && client.userId === event.clientUserId);
    if (!allowed) continue;
    try {
      client.ws.send(payload);
    } catch {
      clients.delete(client);
    }
  }
}
