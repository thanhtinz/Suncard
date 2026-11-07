import { NextResponse } from "next/server";
import { ApiError } from "@/modules/security";
import { randomToken } from "./crypto";

// Error envelope thống nhất: { error: { code, message }, request_id } (doc 06).
const CODE_STATUS: Record<string, number> = {
  AUTH_INVALID: 401, SIGNATURE_INVALID: 401, REPLAY_DETECTED: 401,
  PERMISSION_DENIED: 403, STEP_UP_REQUIRED: 403,
  PRODUCT_NOT_FOUND: 404, ORDER_NOT_FOUND: 404, NOT_FOUND: 404,
  PLAYER_INVALID: 422, REGION_UNSUPPORTED: 422, VALIDATION_EXPIRED: 422,
  INSUFFICIENT_BALANCE: 402, CREDIT_LIMIT_EXCEEDED: 402,
  DUPLICATE_REQUEST: 409, CARD_OUT_OF_STOCK: 409, INVALID_TRANSITION: 409,
  RATE_LIMITED: 429, PROVIDER_UNAVAILABLE: 503, ORDER_PENDING: 202, ORDER_UNKNOWN: 202,
};

export function errorCodeOf(e: unknown): { code: string; status: number; message: string } {
  if (e instanceof ApiError) return { code: e.code, status: e.status, message: e.message };
  const msg = e instanceof Error ? e.message : String(e);
  const raw = msg.split(":")[0];
  if (raw.startsWith("VALIDATION")) return { code: "VALIDATION_ERROR", status: 422, message: msg };
  if (raw === "INVALID_TRANSITION") return { code: "INVALID_TRANSITION", status: 409, message: msg };
  if (CODE_STATUS[raw]) return { code: raw, status: CODE_STATUS[raw], message: msg };
  return { code: "INTERNAL_ERROR", status: 500, message: msg };
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ data, request_id: `req_${randomToken(8)}` }, { status });
}

export function fail(e: unknown) {
  const { code, status, message } = errorCodeOf(e);
  return NextResponse.json({ error: { code, message }, request_id: `req_${randomToken(8)}` }, { status });
}

/** Serialize BigInt đệ quy cho JSON response. */
export function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

export async function readJson(req: Request): Promise<any> {
  try { return await req.json(); } catch { return {}; }
}
