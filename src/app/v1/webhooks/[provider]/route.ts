import { prisma } from "@/lib/prisma";
import { ok, fail, serialize } from "@/lib/api";
import { sha256Hex } from "@/lib/crypto";
import { verifyProviderSignature, payloadHash, getAdapter } from "@/modules/providers";
import { inquireOrder } from "@/modules/orders-service";
import type { DB } from "@/modules/ledger";

// Webhook inbound từ provider: verify HMAC -> dedupe theo (provider, event_id) -> xử lý idempotent.
export async function POST(req: Request, { params }: { params: { provider: string } }) {
  try {
    const raw = await req.text();
    const provider = await prisma.provider.findUnique({ where: { code: params.provider.toUpperCase() } });
    if (!provider) throw new Error("NOT_FOUND");
    const secret = process.env.PROVIDER_WEBHOOK_SECRET || "dev-provider-secret";
    const signature = req.headers.get("x-provider-signature");
    let payload: any = {};
    try { payload = JSON.parse(raw); } catch {
      // Upstream gạch thẻ có thể callback dạng form-urlencoded.
      try { new URLSearchParams(raw).forEach((v, k) => { payload[k] = v; }); } catch { /* giữ rỗng */ }
    }
    if (provider.code === "HTTP_CHARGING") {
      // Callback chuẩn chargingws xác thực bằng callback_sign = md5(partner_key + code + serial);
      // vẫn chấp nhận thêm HMAC nội bộ nếu upstream cấu hình gửi kèm.
      const { verifyHttpChargingCallback } = await import("@/modules/http-charging");
      const okCb = await verifyHttpChargingCallback(prisma as unknown as DB, payload);
      if (!okCb && !verifyProviderSignature(raw, signature, secret)) throw new Error("SIGNATURE_INVALID");
      if (payload.serial && !payload.code && payload.seri) payload.serial = payload.seri;
    } else if (!verifyProviderSignature(raw, signature, secret)) {
      throw new Error("SIGNATURE_INVALID");
    }
    const eventId = String(payload.event_id ?? payload.id ?? sha256Hex(raw));
    const existing = await prisma.providerWebhookEvent.findUnique({ where: { providerId_eventId: { providerId: provider.id, eventId } } });
    if (existing) return ok(serialize({ deduped: true, status: existing.status }));
    const event = await prisma.providerWebhookEvent.create({
      data: { providerId: provider.id, eventId, eventType: payload.event_type ?? payload.status, payloadHash: payloadHash(raw), status: "RECEIVED" },
    });
    // Xử lý: tìm đơn theo external_ref và phân giải qua inquiry của adapter (không tự đoán SUCCESS từ HTTP 200).
    const externalRef = payload.external_ref ?? payload.provider_ref ?? payload.trans_id;
    let processed = "PROCESSED";
    if (externalRef || payload.request_id) {
      let order = externalRef
        ? await prisma.order.findFirst({ where: { providerId: provider.id, providerRef: String(externalRef) } })
        : null;
      // Callback chargingws mang request_id = id đơn nội bộ — fallback tra theo id.
      if (!order && payload.request_id) {
        const byId = await prisma.order.findUnique({ where: { id: String(payload.request_id) } });
        if (byId && byId.providerId === provider.id) order = byId;
      }
      if (order && ["UNKNOWN", "PENDING", "PROCESSING"].includes(order.status)) {
        const adapter = getAdapter(provider.code);
        const wh = await adapter.processWebhook(prisma as unknown as DB, payload, true);
        if (wh !== "UNSUPPORTED" && wh.status === "SUCCESS") await inquireOrder(order.id, "webhook");
        else if (wh !== "UNSUPPORTED" && wh.status === "FAILED" && order.status !== "UNKNOWN") await inquireOrder(order.id, "webhook");
        // UNKNOWN từ webhook: giữ nguyên UNKNOWN, không failover.
      }
    }
    await prisma.providerWebhookEvent.update({ where: { id: event.id }, data: { status: processed, processedAt: new Date() } });
    return ok(serialize({ received: true, event_id: eventId }));
  } catch (e) { return fail(e); }
}
