import type { Request } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";

export interface AuditPayload {
  action: string;
  entityType: string;
  entityId?: string | null;
  entityName?: string | null;
  companyId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function logAuditEvent(
  req: Request,
  actor: User,
  payload: AuditPayload
): void {
  const ipAddress =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.ip ??
    null;
  const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;

  storage
    .insertAuditLog({
      actorUserId: actor.id,
      actorName: actor.name ?? actor.username,
      actorEmail: actor.email ?? "",
      action: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId ?? null,
      entityName: payload.entityName ?? null,
      companyId: payload.companyId ?? null,
      projectId: payload.projectId ?? null,
      metadata: payload.metadata ?? null,
      ipAddress,
      userAgent,
    })
    .catch((err) => {
      console.error("[audit-log] Failed to write audit event:", err);
    });
}
