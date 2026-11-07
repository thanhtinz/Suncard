import { randomUUID } from "crypto";
import type { DB } from "./ledger";

// Audit append-only theo schema tối thiểu bảng 17 (Security Spec):
// event_id, timestamp UTC, actor_type/actor_id, action, resource, result,
// source_ip, device_id, correlation_id, reason/approval_id, before_after_summary.
// TUYỆT ĐỐI không ghi secret/plaintext: sanitize tự động mask mọi key nhạy cảm.
// Không tồn tại hàm sửa/xoá audit trong codebase — kể cả Super Admin (SEC-LOG-01).

const SENSITIVE_KEY = /secret|password|passwd|pin|serial|token|api[_-]?key|private|credential|cvv|pan/i;

export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (Array.isArray(value)) return value.map((v) => sanitizeForAudit(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "***MASKED***" : sanitizeForAudit(v, depth + 1);
    }
    return out;
  }
  return value;
}

export async function logAudit(
  db: DB,
  params: {
    actorId?: string | null;
    actorType?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    result?: string; // SUCCESS|DENIED|FAILED|PENDING
    deviceId?: string;
    correlationId?: string;
    reason?: string;
    approvalId?: string;
    summary?: string;
    before?: unknown;
    after?: unknown;
    ip?: string;
    metadata?: unknown;
  }
) {
  return db.auditLog.create({
    data: {
      eventId: randomUUID(),
      actorId: params.actorId ?? undefined,
      actorType: params.actorType ?? "USER",
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      result: params.result ?? "SUCCESS",
      deviceId: params.deviceId,
      correlationId: params.correlationId ?? randomUUID(),
      reason: params.reason,
      approvalId: params.approvalId,
      summary: params.summary,
      before: sanitizeForAudit(params.before) as never,
      after: sanitizeForAudit(params.after) as never,
      ip: params.ip,
      metadata: sanitizeForAudit(params.metadata) as never,
    },
  });
}

export async function notifyUser(
  db: DB,
  params: { userId: string; type: string; title: string; body?: string; resourceType?: string; resourceId?: string }
) {
  return db.notification.create({ data: params });
}
