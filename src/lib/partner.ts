import { prisma } from "@/lib/prisma";
import { fail, ok, serialize } from "@/lib/api";
import { verifyPartnerRequest, ApiError, type PartnerContext } from "@/modules/security";

// Helper dùng chung cho route /v1: verify HMAC + nonce + rate limit, ghi api_usage_logs.
export async function withPartner(
  req: Request,
  handler: (ctx: PartnerContext & { body: any; rawBody: string }) => Promise<Response>
): Promise<Response> {
  const started = Date.now();
  let ctx: PartnerContext | null = null;
  try {
    const rawBody = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();
    ctx = await verifyPartnerRequest(req, rawBody);
    if (!ctx.userId) throw new ApiError("PERMISSION_DENIED", 403, "API client chưa gắn tài khoản ví");
    let body: any = {};
    if (rawBody) { try { body = JSON.parse(rawBody); } catch { body = {}; } }
    const res = await handler({ ...ctx, body, rawBody });
    prisma.apiUsageLog.create({
      data: { clientId: ctx.client.id, apiKeyId: ctx.apiKey.id, method: req.method, path: new URL(req.url).pathname, statusCode: res.status, latencyMs: Date.now() - started },
    }).catch(() => undefined);
    return res;
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 500;
    if (ctx) {
      prisma.apiUsageLog.create({
        data: { clientId: ctx.client.id, method: req.method, path: new URL(req.url).pathname, statusCode: status, latencyMs: Date.now() - started },
      }).catch(() => undefined);
    }
    return fail(e);
  }
}

export function partnerOk(data: unknown, status = 200) {
  return ok(serialize(data), status);
}

/** Cursor pagination đơn giản: cursor = id của bản ghi cuối trang trước. */
export function cursorOf(url: URL) {
  return url.searchParams.get("cursor") ?? undefined;
}
export function pageSize(url: URL, def = 20) {
  return Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? def)));
}

export function idempotencyKeyOf(req: Request, body: any): string {
  const key = req.headers.get("idempotency-key") ?? body?.idempotency_key;
  if (!key) throw new ApiError("VALIDATION_ERROR", 422, "Thiếu Idempotency-Key");
  return String(key);
}
