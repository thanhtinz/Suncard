import crypto from "crypto";
import { hmacSha256Hex, randomToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import type { DB } from "./ledger";

// Webhook outbound theo outbox pattern: event ghi vào webhook_deliveries (PENDING),
// worker deliver có retry backoff + chữ ký HMAC. Consumer dedupe theo event_id.

export const WEBHOOK_EVENTS = [
  "order.created", "order.processing", "order.success", "order.failed", "order.refunded",
  "wallet.deposit.success", "card.delivery.completed",
] as const;

// SSRF guard (spec bảng 15): chặn URL tới địa chỉ nội bộ/metadata, trừ khi Admin bật allow_private_egress (dev).
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h === "metadata.google.internal") return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0) return true;
  }
  if (h === "::1" || h.startsWith("fe80:")) return true;
  return false;
}
export async function assertEgressAllowed(url: string) {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("EGRESS_URL_INVALID"); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("EGRESS_PROTOCOL_BLOCKED");
  if (isPrivateHost(parsed.hostname)) {
    const { getSetting } = await import("./settings");
    const allowed = await getSetting<boolean>("security.allow_private_egress", false);
    if (!allowed) throw new Error("EGRESS_PRIVATE_BLOCKED");
  }
}

export function signWebhook(secret: string, payloadJson: string): string {
  return hmacSha256Hex(secret, payloadJson);
}

export async function enqueueWebhookEvent(
  db: DB,
  params: { eventType: string; resourceId: string; data: Record<string, unknown>; userId?: string; clientId?: string }
) {
  const eventId = `evt_${randomToken(12)}`;
  const payload = {
    event_id: eventId,
    event_type: params.eventType,
    created_at: new Date().toISOString(),
    resource_id: params.resourceId,
    data: params.data,
  };
  const endpoints = await db.webhookEndpoint.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        params.clientId ? { clientId: params.clientId } : { id: "__none__" },
        params.userId ? { userId: params.userId } : { id: "__none__" },
        { clientId: null, userId: null },
      ],
    },
  });
  const matched = endpoints.filter((e: any) => {
    const evts = (e.events as string[]) ?? [];
    return evts.includes(params.eventType) || evts.includes("*");
  });
  if (matched.length === 0) {
    // Vẫn ghi outbox (endpointId null) để truy vết — worker bỏ qua vì không có URL.
    await db.webhookDelivery.create({
      data: { eventId, eventType: params.eventType, resourceId: params.resourceId, payload, status: "DELIVERED", attempts: 0, lastError: "NO_ENDPOINT_LOGGED_ONLY" },
    });
    return { eventId, deliveries: 0 };
  }
  let deliveries = 0;
  for (const ep of matched) {
    // secret lưu hash; chữ ký dùng secret gốc của endpoint được lưu dạng mã hoá ở webhook secretRef — bản này dùng PARTNER_WEBHOOK_SECRET hệ thống cho endpoint nội bộ.
    const secret = process.env.PARTNER_WEBHOOK_SECRET || "dev-webhook-secret";
    const signature = signWebhook(secret, JSON.stringify(payload));
    await db.webhookDelivery.create({
      data: { endpointId: ep.id, eventId: `${eventId}:${ep.id}`, eventType: params.eventType, resourceId: params.resourceId, payload, signature, status: "PENDING", nextRetryAt: new Date() },
    });
    deliveries++;
  }
  return { eventId, deliveries };
}

/** Worker: giao các delivery đến hạn. fetchImpl cho phép test/offline. Backoff: 1m,5m,15m,1h,6h -> DEAD sau 5 lần. */
export async function deliverDueWebhooks(fetchImpl: typeof fetch = fetch, limit = 20) {
  const due = await prisma.webhookDelivery.findMany({
    where: { status: "PENDING", endpointId: { not: null }, OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }] },
    take: limit,
    orderBy: { createdAt: "asc" },
  });
  const backoffMinutes = [1, 5, 15, 60, 360];
  let delivered = 0, failed = 0;
  for (const d of due) {
    const ep = await prisma.webhookEndpoint.findUnique({ where: { id: d.endpointId! } });
    if (!ep || ep.status !== "ACTIVE") {
      await prisma.webhookDelivery.update({ where: { id: d.id }, data: { status: "DEAD", lastError: "ENDPOINT_INACTIVE" } });
      continue;
    }
    const body = JSON.stringify(d.payload);
    try {
      await assertEgressAllowed(ep.url);
      const res = await fetchImpl(ep.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Suncard-Event": d.eventType, "X-Suncard-Signature": d.signature ?? "" },
        body,
      });
      if (res.ok) {
        await prisma.webhookDelivery.update({ where: { id: d.id }, data: { status: "DELIVERED", attempts: d.attempts + 1, lastError: null } });
        delivered++;
      } else {
        throw new Error(`HTTP_${res.status}`);
      }
    } catch (e: any) {
      const attempts = d.attempts + 1;
      const dead = attempts >= 5;
      await prisma.webhookDelivery.update({
        where: { id: d.id },
        data: {
          status: dead ? "DEAD" : "PENDING",
          attempts,
          lastError: String(e?.message ?? e).slice(0, 200),
          nextRetryAt: dead ? null : new Date(Date.now() + backoffMinutes[Math.min(attempts - 1, 4)] * 60000),
        },
      });
      failed++;
    }
  }
  return { processed: due.length, delivered, failed };
}

export function verifyOutboundSignature(secret: string, payloadJson: string, signature: string): boolean {
  const expected = signWebhook(secret, payloadJson);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
