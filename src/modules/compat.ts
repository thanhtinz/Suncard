import { prisma } from "@/lib/prisma";
import type { DB } from "./ledger";
import { md5Hex, partnerKeyOf, ipAllowed } from "./charging";
import { apiTypeAllows } from "@/lib/api-types";

// ============================================================================
// Hạ tầng chung cho 2 API tương thích thị trường: /api/rechargews (nạp topup)
// và /api/cardws (mua mã thẻ Softcard) — cùng cặp Partner ID + partner_key
// với Charging (/chargingws/v2) và Partner API /v1.
// Sign MD5:
//   lệnh có request_id:  md5(partner_key + partner_id + command + request_id)
//   lệnh không request_id: md5(partner_key + partner_id + command)
// ============================================================================

export async function parseFields(req: Request): Promise<Record<string, string>> {
  const url = new URL(req.url);
  const out: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { out[k] = v; });
  if (req.method === "POST") {
    const ct = req.headers.get("content-type") ?? "";
    try {
      if (ct.includes("application/json")) {
        const j = await req.json();
        for (const [k, v] of Object.entries(j)) out[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
      } else {
        const text = await req.text();
        new URLSearchParams(text).forEach((v, k) => { out[k] = v; });
      }
    } catch { /* giữ query params */ }
  }
  return out;
}

export type CompatModule = "RECHARGE" | "SOFTCARD";
export class CompatError extends Error {
  constructor(public code: string) { super(code); }
}

/** Nạp + kiểm tra client: tồn tại, ACTIVE, đúng loại API, IP whitelist. Trả partner_key đã giải mã. */
export async function loadCompatClient(req: Request, partnerId: string, module: CompatModule) {
  const client = await prisma.apiClient.findUnique({ where: { clientId: partnerId ?? "" } });
  if (!client || client.status !== "ACTIVE" || !client.userId) throw new CompatError("wrong_signature");
  if (!apiTypeAllows(client.apiType ?? "FULL", module)) throw new CompatError("wrong_signature");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!ipAllowed(client, ip)) throw new CompatError("ip_not_allowed");
  const partnerKey = await partnerKeyOf(prisma as unknown as DB, client);
  if (!partnerKey) throw new CompatError("wrong_signature");
  return { client, partnerKey };
}

export function signWithRequest(partnerKey: string, partnerId: string, command: string, requestId: string): string {
  return md5Hex(`${partnerKey}${partnerId}${command}${requestId}`);
}
export function signNoRequest(partnerKey: string, partnerId: string, command: string): string {
  return md5Hex(`${partnerKey}${partnerId}${command}`);
}
export function verifyCompatSign(partnerKey: string, partnerId: string, command: string, requestId: string | null, sign: string): boolean {
  const s = (sign ?? "").toLowerCase();
  if (!s) return false;
  return requestId !== null
    ? s === signWithRequest(partnerKey, partnerId, command, requestId)
    : s === signNoRequest(partnerKey, partnerId, command);
}

export async function walletBalanceMinor(userId: string): Promise<bigint> {
  const acc = await prisma.ledgerAccount.findUnique({ where: { code: `WALLET:${userId}:AVAILABLE` } });
  return (acc?.balanceMinor as bigint) ?? BigInt(0);
}

/** Trạng thái đơn SunCard -> trạng thái recharge (chuỗi). */
export function rechargeStatus(orderStatus: string): string {
  switch (orderStatus) {
    case "SUCCESS": return "completed";
    case "FAILED": return "failed";
    case "CANCELLED": return "canceled";
    case "REFUNDED": case "REFUND_PENDING": return "refunded";
    default: return "pending";
  }
}
