import crypto from "crypto";
import { decryptSecret } from "@/lib/crypto";
import type { DB } from "./ledger";

// ============================================================================
// Charging Compat API (chuẩn chung thị trường gạch thẻ VN — xem docs/research/card-exchange-sites.md)
// Endpoint: POST /chargingws/v2 (command=charging|check), GET /chargingws/v2/getfee
// Sign MD5 — chấp nhận CẢ HAI thế hệ:
//   legacy:   md5(partner_key + code + serial)
//   extended: md5(partner_key + code + command + partner_id + request_id + serial + telco)
//   check:    md5(partner_key + command + partner_id + request_id)
// Callback: callback_sign = md5(partner_key + code + serial)
// Status: 99 đang xử lý | 1 đúng mệnh giá | 2 sai mệnh giá | 3 thẻ lỗi | 4 bảo trì
// Lỗi request: 100 chung | 101 check không thấy | 102 sai sign/IP/dữ liệu | 103 exception | 104 sai command
// ============================================================================

export function md5Hex(input: string): string {
  return crypto.createHash("md5").update(input).digest("hex");
}

export const CHARGING_TELCOS = ["VIETTEL", "VINAPHONE", "MOBIFONE", "VNMOBI", "ZING", "GARENA", "VCOIN", "GATE", "SCOIN"] as const;

export function normalizeTelco(raw: string): string | null {
  const t = (raw ?? "").trim().toUpperCase();
  if (t === "VIETNAMOBILE" || t === "VIETNAMMOBI") return "VNMOBI";
  if (t === "MOBI") return "MOBIFONE";
  if (t === "VINA") return "VINAPHONE";
  return (CHARGING_TELCOS as readonly string[]).includes(t) ? t : null;
}

/** partner_key của client: secret ký lưu mã hoá AES-GCM trong ApiKey.secretEnc (key chỉ hiện 1 lần khi tạo). */
export async function partnerKeyOf(db: DB, client: any): Promise<string | null> {
  const key = await db.apiKey.findFirst({ where: { clientId: client.id, status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
  if (!key?.secretEnc) return null;
  try { return decryptSecret(key.secretEnc); } catch { return null; }
}

export function legacySign(partnerKey: string, code: string, serial: string): string {
  return md5Hex(`${partnerKey}${code}${serial}`);
}
export function extendedSign(partnerKey: string, f: { code: string; command: string; partnerId: string; requestId: string; serial: string; telco: string }): string {
  return md5Hex(`${partnerKey}${f.code}${f.command}${f.partnerId}${f.requestId}${f.serial}${f.telco}`);
}
export function checkSign(partnerKey: string, f: { command: string; partnerId: string; requestId: string }): string {
  return md5Hex(`${partnerKey}${f.command}${f.partnerId}${f.requestId}`);
}
export function callbackSign(partnerKey: string, code: string, serial: string): string {
  return md5Hex(`${partnerKey}${code}${serial}`);
}

export interface ChargingFields {
  command: string; partner_id: string; request_id: string;
  telco?: string; amount?: string; serial?: string; code?: string; sign: string;
}

/** Verify sign cho command=charging: thử extended trước, legacy sau (tương thích ngược như Nappay). */
export function verifyChargingSign(partnerKey: string, f: ChargingFields): boolean {
  const sign = (f.sign ?? "").toLowerCase();
  if (!sign) return false;
  const ext = extendedSign(partnerKey, {
    code: f.code ?? "", command: f.command, partnerId: f.partner_id,
    requestId: f.request_id, serial: f.serial ?? "", telco: (f.telco ?? "").toUpperCase(),
  });
  if (sign === ext) return true;
  return sign === legacySign(partnerKey, f.code ?? "", f.serial ?? "");
}

/** Verify sign cho command=check: công thức riêng của lệnh check; cũng chấp nhận legacy nếu có code/serial. */
export function verifyCheckSign(partnerKey: string, f: ChargingFields): boolean {
  const sign = (f.sign ?? "").toLowerCase();
  if (!sign) return false;
  if (sign === checkSign(partnerKey, { command: f.command, partnerId: f.partner_id, requestId: f.request_id })) return true;
  if (f.code && f.serial) return sign === legacySign(partnerKey, f.code, f.serial);
  return false;
}

// ---------- Bảng phí gạch thẻ (DB: exchange_fee_rules) ----------
export interface ExchangeFee { feeBps: number; penaltyBps: number; groupCode: string }

/** Tra phí với fallback nhóm: API -> AGENT -> MEMBER (nhóm cao hơn không có dòng riêng thì dùng nhóm thấp hơn). */
export async function getExchangeFee(db: DB, telco: string, faceValueMinor: bigint, groupCode: string): Promise<ExchangeFee | null> {
  const chain = groupCode === "API" ? ["API", "AGENT", "MEMBER"] : groupCode === "AGENT" ? ["AGENT", "MEMBER"] : ["MEMBER"];
  for (const g of chain) {
    const row = await db.exchangeFeeRule.findUnique({
      where: { telco_faceValueMinor_groupCode: { telco: telco.toUpperCase(), faceValueMinor, groupCode: g } },
    });
    if (row && row.isActive) return { feeBps: row.feeBps, penaltyBps: row.penaltyBps, groupCode: g };
  }
  return null;
}

export async function denominationsOf(db: DB, telco: string): Promise<bigint[]> {
  const rows = await db.exchangeFeeRule.findMany({
    where: { telco: telco.toUpperCase(), groupCode: "MEMBER", isActive: true },
    orderBy: { faceValueMinor: "asc" },
  });
  return rows.map((r: any) => r.faceValueMinor as bigint);
}

/** Bảng phí cho getfee: mọi dòng active của nhóm phí của partner (kèm fallback về MEMBER). */
export async function feeTableForGroup(db: DB, groupCode: string) {
  const rows = await db.exchangeFeeRule.findMany({ where: { isActive: true }, orderBy: [{ telco: "asc" }, { faceValueMinor: "asc" }] });
  const byKey = new Map<string, any>();
  for (const r of rows) {
    const k = `${r.telco}:${r.faceValueMinor.toString()}`;
    const cur = byKey.get(k);
    const rank = (g: string) => (g === groupCode ? 3 : g === "AGENT" ? 2 : g === "MEMBER" ? 1 : 0);
    if (!cur || rank(r.groupCode) > rank(cur.groupCode)) byKey.set(k, r);
  }
  return [...byKey.values()]
    .filter((r) => {
      // Chỉ trả dòng thuộc nhóm <= nhóm của partner theo fallback chain
      if (groupCode === "MEMBER") return r.groupCode === "MEMBER";
      if (groupCode === "AGENT") return ["AGENT", "MEMBER"].includes(r.groupCode);
      return true;
    })
    .map((r) => ({
      telco: r.telco,
      value: Number(r.faceValueMinor),
      fees: r.feeBps / 100,
      penalty: r.penaltyBps / 100,
    }));
}

// ---------- Status mapping hai chiều ----------
/** SunCard order status -> status chargingws. UNKNOWN/REVIEW vẫn trả 99 (đang xử lý) cho partner. */
export function toChargingStatus(orderStatus: string, exchange?: { wrongValue?: boolean } | null): number {
  switch (orderStatus) {
    case "SUCCESS": return exchange?.wrongValue ? 2 : 1;
    case "FAILED": return 3;
    default: return 99; // CREATED..PROCESSING, UNKNOWN, REVIEW -> đang xử lý
  }
}

export function chargingMessage(status: number): string {
  return {
    99: "Thẻ đã gửi thành công và đang chờ xử lý",
    1: "Thành công đúng mệnh giá",
    2: "Thành công nhưng sai mệnh giá — tính theo mệnh giá thật",
    3: "Thẻ lỗi, thẻ sai hoặc đã sử dụng",
    4: "Nhà mạng đang bảo trì",
    100: "Lỗi xử lý giao dịch",
    101: "Không tìm thấy giao dịch",
    102: "Dữ liệu xác thực không hợp lệ hoặc chữ ký sign sai",
    103: "Lỗi hệ thống khi xử lý request",
    104: "Command không hợp lệ",
  }[status] ?? "Không rõ trạng thái";
}

export interface ChargingResponse {
  trans_id: string; request_id: string; status: number; message: string;
  value: number; declared_value: number; amount: number;
  telco: string; serial: string; code: string; callback_sign: string;
}

export function buildChargingResponse(params: {
  partnerKey: string; order: any; exchange: any; serial: string; code: string;
}): ChargingResponse {
  const status = toChargingStatus(params.order.status, params.exchange);
  const declared = params.exchange ? Number(params.exchange.declaredValueMinor) : Number(params.order.subtotalMinor ?? 0);
  const value = params.exchange?.acceptedValueMinor != null ? Number(params.exchange.acceptedValueMinor) : 0;
  const amount = status === 1 || status === 2 ? Number(params.exchange?.payoutMinor ?? params.order.totalMinor ?? 0) : 0;
  return {
    trans_id: params.order.id,
    request_id: (params.order.metadata as any)?.compat?.request_id ?? params.order.idempotencyKey,
    status,
    message: chargingMessage(status),
    value,
    declared_value: declared,
    amount,
    telco: params.exchange?.carrier ?? "",
    serial: params.serial,
    code: params.code,
    callback_sign: (params.order.metadata as any)?.compat?.callback_sign ?? callbackSign(params.partnerKey, params.code, params.serial),
  };
}

/** Gửi callback về partner (nếu client có callbackUrl): ghi webhook_deliveries + thử giao ngay 1 lần. */
export async function sendChargingCallbackForOrder(db: DB, orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  const compat = (order.metadata as any)?.compat;
  if (!compat?.partner_id) return;
  const client = await db.apiClient.findUnique({ where: { clientId: compat.partner_id } });
  if (!client?.callbackUrl) return;
  const partnerKey = await partnerKeyOf(db, client);
  if (!partnerKey) return;
  const exchange = await db.exchangeOrder.findUnique({ where: { orderId } });
  const payload = buildChargingResponse({ partnerKey, order, exchange, serial: compat.serial_masked ?? "", code: compat.code_masked ?? "" });
  let endpoint = await db.webhookEndpoint.findFirst({ where: { clientId: client.id, url: client.callbackUrl } });
  if (!endpoint) {
    endpoint = await db.webhookEndpoint.create({
      data: { clientId: client.id, userId: client.userId, url: client.callbackUrl, events: ["charging.callback"], secretHash: "md5-callback-sign", status: "ACTIVE" },
    });
  }
  const delivery = await db.webhookDelivery.create({
    data: {
      endpointId: endpoint.id, eventId: `charging:${order.id}:${payload.status}`, eventType: "charging.callback",
      resourceId: order.id, payload, signature: payload.callback_sign, status: "PENDING", nextRetryAt: new Date(),
    },
  }).catch(() => null);
  if (!delivery) return; // đã có delivery cho trạng thái này (dedupe theo eventId)
  // Thử giao ngay; thất bại thì worker /api/cron/webhooks retry theo backoff.
  try {
    const { assertEgressAllowed } = await import("./webhooks");
    await assertEgressAllowed(client.callbackUrl);
    const method = (client.callbackMethod ?? "POST").toUpperCase();
    const url = method === "GET"
      ? `${client.callbackUrl}${client.callbackUrl.includes("?") ? "&" : "?"}${new URLSearchParams(Object.entries(payload).map(([k, v]) => [k, String(v)]))}`
      : client.callbackUrl;
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(payload),
    });
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: res.ok ? { status: "DELIVERED", attempts: 1 } : { status: "PENDING", attempts: 1, lastError: `HTTP_${res.status}` },
    });
  } catch (e: any) {
    await db.webhookDelivery.update({ where: { id: delivery.id }, data: { attempts: 1, lastError: String(e?.message ?? e).slice(0, 200) } }).catch(() => undefined);
  }
}

/** IP whitelist của client (nếu cấu hình): ipAllowlist dạng mảng string trong ApiClient. */
export function ipAllowed(client: any, ip: string | null): boolean {
  const list = client?.ipAllowlist as string[] | null;
  if (!list || !Array.isArray(list) || list.length === 0) return true;
  if (!ip) return false;
  return list.includes(ip) || list.includes("*");
}
