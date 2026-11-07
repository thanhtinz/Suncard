import { decryptSecret } from "@/lib/crypto";
import { legacySign, extendedSign, checkSign, callbackSign, normalizeTelco } from "./charging";
import { getNumberSetting } from "./settings";
import type { DB } from "./ledger";
import type { ProviderAdapter, CreateOrderResult, ProviderOrderStatus } from "./providers";

// ============================================================================
// HttpChargingAdapter (Phase 2) — SunCard đóng vai KHÁCH gọi upstream gạch thẻ
// theo đúng chuẩn thị trường /chargingws/v2 (xem docs/research/card-exchange-sites.md):
//   POST {baseUrl}            command=charging|check (form-urlencoded)
//   GET  {baseUrl}/getfee     bảng phí của upstream
// Sign MD5: legacy md5(key+code+serial) hoặc extended md5(key+code+command+
// partner_id+request_id+serial+telco) — chọn qua config.signMode (mặc định extended).
// Status upstream: 99 đang xử lý | 1 đúng mệnh giá | 2 sai mệnh giá | 3 thẻ lỗi | 4 bảo trì.
// Timeout/lỗi mạng SAU submit -> UNKNOWN (không failover, chờ inquiry) — luật cứng doc 07.
// Cấu hình trong providers.config (Admin sửa): { baseUrl, partnerId, signMode }.
// partner_key: ProviderCredential name="partner_key" — secretEnc mã hoá AES-GCM
// (ghi qua duyệt kép PROVIDER_SECRET) hoặc secretRef env:<NAME>.
// ============================================================================

export interface HttpChargingConfig {
  baseUrl: string;
  partnerId: string;
  signMode: "extended" | "legacy";
}

export async function httpChargingConfigOf(db: DB, provider: any): Promise<{ cfg: HttpChargingConfig; partnerKey: string }> {
  // provider.config là cột Json: có nơi lưu object, có nơi lưu chuỗi JSON — chấp nhận cả hai.
  let cfgRaw = (provider?.config as any) ?? {};
  if (typeof cfgRaw === "string") { try { cfgRaw = JSON.parse(cfgRaw); } catch { cfgRaw = {}; } }
  const baseUrl = String(cfgRaw.baseUrl ?? "").replace(/\/+$/, "");
  const partnerId = String(cfgRaw.partnerId ?? "");
  if (!baseUrl || !partnerId) throw new Error("PROVIDER_CONFIG_MISSING");
  const creds = await db.providerCredential.findMany({ where: { providerId: provider.id, isActive: true }, orderBy: { createdAt: "desc" } });
  const keyCred = creds.find((c: any) => c.name === "partner_key") ?? creds.find((c: any) => c.secretEnc) ?? creds[0];
  let partnerKey: string | null = null;
  if (keyCred?.secretEnc) {
    try { partnerKey = decryptSecret(keyCred.secretEnc); } catch { partnerKey = null; }
  }
  if (!partnerKey && keyCred?.secretRef?.startsWith("env:")) {
    partnerKey = process.env[keyCred.secretRef.slice(4)] ?? null;
  }
  if (!partnerKey) throw new Error("PROVIDER_SECRET_MISSING");
  return { cfg: { baseUrl, partnerId, signMode: cfgRaw.signMode === "legacy" ? "legacy" : "extended" }, partnerKey };
}

function signFor(cfg: HttpChargingConfig, partnerKey: string, f: { code: string; command: string; requestId: string; serial: string; telco: string }): string {
  return cfg.signMode === "legacy"
    ? legacySign(partnerKey, f.code, f.serial)
    : extendedSign(partnerKey, { code: f.code, command: f.command, partnerId: cfg.partnerId, requestId: f.requestId, serial: f.serial, telco: f.telco });
}

async function postForm(url: string, fields: Record<string, string>, timeoutMs: number): Promise<any> {
  const { assertEgressAllowed } = await import("./webhooks");
  await assertEgressAllowed(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
      signal: ctrl.signal,
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { _unparsed: text, _httpStatus: res.status }; }
  } finally {
    clearTimeout(timer);
  }
}

/** Map status chargingws -> trạng thái provider nội bộ. */
export function mapChargingStatus(raw: unknown): { status: ProviderOrderStatus; rawStatus: string } {
  const n = Number(raw);
  switch (n) {
    case 1: return { status: "SUCCESS", rawStatus: "1" };
    case 2: return { status: "SUCCESS", rawStatus: "2" };
    case 3: return { status: "FAILED", rawStatus: "3" };
    case 4: return { status: "FAILED", rawStatus: "4_MAINTENANCE" };
    case 99: return { status: "PENDING", rawStatus: "99" };
    default: return { status: "FAILED", rawStatus: String(raw ?? "UNKNOWN_CODE") };
  }
}

function toCreateResult(resp: any, fallbackFace: bigint): CreateOrderResult {
  if (!resp || typeof resp !== "object" || resp._unparsed) {
    return { status: "UNKNOWN", rawStatus: "UNPARSED_RESPONSE", message: "Upstream trả phản hồi không đọc được — chờ inquiry" };
  }
  const { status, rawStatus } = mapChargingStatus(resp.status);
  const value = resp.value != null && resp.value !== "" ? BigInt(Math.trunc(Number(resp.value))) : undefined;
  const accepted = status === "SUCCESS" ? (rawStatus === "2" ? (value ?? fallbackFace) : fallbackFace) : undefined;
  return {
    status,
    externalRef: resp.trans_id ? String(resp.trans_id) : undefined,
    rawStatus,
    message: resp.message ? String(resp.message) : undefined,
    acceptedValueMinor: accepted,
  };
}

async function loadProvider(db: DB) {
  const provider = await db.provider.findUnique({ where: { code: "HTTP_CHARGING" } });
  if (!provider) throw new Error("PROVIDER_NOT_FOUND:HTTP_CHARGING");
  return provider;
}

export const HttpChargingAdapter: ProviderAdapter = {
  code: "HTTP_CHARGING",
  async authenticate(db) {
    try { await httpChargingConfigOf(db, await loadProvider(db)); return true; } catch { return false; }
  },
  async getBalance() { return "UNSUPPORTED"; },
  async getCatalog(db) { return fetchUpstreamFees(db, await loadProvider(db)).catch(() => []); },
  async getProducts() { return []; },
  async getPrice() { return "UNSUPPORTED"; },
  async validatePlayer() { return "UNSUPPORTED"; },

  async createOrder(db, input) {
    const started = Date.now();
    if (!input.card) return { status: "UNSUPPORTED", rawStatus: "ONLY_CARD_EXCHANGE", message: "HTTP_CHARGING chỉ hỗ trợ gạch thẻ" };
    const provider = await loadProvider(db);
    const { cfg, partnerKey } = await httpChargingConfigOf(db, provider);
    const timeoutMs = await getNumberSetting("provider.http_timeout_ms", 15000);
    const telco = normalizeTelco(input.card.carrier) ?? input.card.carrier.toUpperCase();
    const fields: Record<string, string> = {
      command: "charging",
      partner_id: cfg.partnerId,
      request_id: input.orderId,
      telco,
      amount: input.card.faceValueMinor.toString(),
      serial: input.card.serial,
      code: input.card.pin,
      sign: signFor(cfg, partnerKey, { code: input.card.pin, command: "charging", requestId: input.orderId, serial: input.card.serial, telco }),
    };
    try {
      const resp = await postForm(cfg.baseUrl, fields, timeoutMs);
      const result = toCreateResult(resp, input.card.faceValueMinor);
      // request_id của upstream chính là orderId — externalRef ưu tiên trans_id, thiếu thì dùng request_id để inquiry được.
      if (!result.externalRef) result.externalRef = input.orderId;
      result.latencyMs = Date.now() - started;
      return result;
    } catch (e: any) {
      // Timeout/mạng sau submit: KHÔNG kết luận thất bại — UNKNOWN chờ inquiry (luật cứng).
      return { status: "UNKNOWN", externalRef: input.orderId, rawStatus: "NETWORK_OR_TIMEOUT", message: String(e?.message ?? e).slice(0, 160), latencyMs: Date.now() - started };
    }
  },

  async getOrderStatus(db, externalRef) {
    const provider = await loadProvider(db);
    const { cfg, partnerKey } = await httpChargingConfigOf(db, provider);
    const timeoutMs = await getNumberSetting("provider.http_timeout_ms", 15000);
    // externalRef có thể là trans_id của upstream — tra lại request_id (= orderId) từ provider_transactions.
    let requestId = externalRef;
    const txn = await db.providerTransaction.findFirst({ where: { providerId: provider.id, externalRef, action: "CREATE" }, orderBy: { createdAt: "desc" } }).catch(() => null);
    if (txn?.orderId) requestId = txn.orderId;
    const fields: Record<string, string> = {
      command: "check",
      partner_id: cfg.partnerId,
      request_id: requestId,
      sign: checkSign(partnerKey, { command: "check", partnerId: cfg.partnerId, requestId }),
    };
    try {
      const resp = await postForm(cfg.baseUrl, fields, timeoutMs);
      if (resp && Number(resp.status) === 101) {
        return { status: "UNKNOWN", externalRef, rawStatus: "101_NOT_FOUND_UPSTREAM", message: "Upstream chưa thấy giao dịch — giữ UNKNOWN, inquiry lại sau" };
      }
      const result = toCreateResult(resp, 0n);
      if (result.status === "SUCCESS" && result.acceptedValueMinor === 0n) result.acceptedValueMinor = undefined;
      result.externalRef = externalRef;
      return result;
    } catch (e: any) {
      return { status: "UNKNOWN", externalRef, rawStatus: "CHECK_NETWORK_ERROR", message: String(e?.message ?? e).slice(0, 160) };
    }
  },

  async cancelOrder() { return "UNSUPPORTED"; },

  async processWebhook(_db, payload: any) {
    // Webhook của upstream gạch thẻ chính là payload callback chargingws (có callback_sign).
    const p = (payload ?? {}) as any;
    const { status } = mapChargingStatus(p.status);
    return {
      eventId: `charging-cb:${p.request_id ?? p.trans_id ?? ""}:${p.status ?? ""}`,
      status,
      externalRef: p.trans_id ? String(p.trans_id) : (p.request_id ? String(p.request_id) : undefined),
    };
  },

  async reconcile(db, period) {
    const provider = await loadProvider(db);
    const detail = await reconcileHttpChargingDetail(db, provider, period);
    return { total: detail.total, matched: detail.matched };
  },
};

/** Kiểm callback_sign của upstream (md5(partner_key + code + serial)) cho webhook route dùng khi provider là HTTP_CHARGING. */
export async function verifyHttpChargingCallback(db: DB, payload: any): Promise<boolean> {
  try {
    const provider = await loadProvider(db);
    const { partnerKey } = await httpChargingConfigOf(db, provider);
    const expected = callbackSign(partnerKey, String(payload?.code ?? ""), String(payload?.serial ?? ""));
    const got = String(payload?.callback_sign ?? "").toLowerCase();
    return got.length > 0 && got === expected;
  } catch { return false; }
}

/** GET {baseUrl}/getfee — bảng phí upstream, chuẩn hoá về [{telco, faceValueMinor, feeBps}]. */
export async function fetchUpstreamFees(db: DB, provider: any): Promise<{ telco: string; faceValueMinor: bigint; feeBps: number }[]> {
  const { cfg } = await httpChargingConfigOf(db, provider);
  const timeoutMs = await getNumberSetting("provider.http_timeout_ms", 15000);
  const { assertEgressAllowed } = await import("./webhooks");
  const url = `${cfg.baseUrl}/getfee?partner_id=${encodeURIComponent(cfg.partnerId)}`;
  await assertEgressAllowed(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const data: any = await res.json().catch(() => null);
    const rows: any[] = Array.isArray(data) ? data : (data?.data ?? data?.fees ?? []);
    const out: { telco: string; faceValueMinor: bigint; feeBps: number }[] = [];
    for (const r of rows) {
      const telco = normalizeTelco(String(r.telco ?? ""));
      const value = Number(r.value ?? r.amount ?? 0);
      const fees = Number(r.fees ?? r.fee ?? NaN);
      if (telco && value > 0 && Number.isFinite(fees)) out.push({ telco, faceValueMinor: BigInt(Math.trunc(value)), feeBps: Math.round(fees * 100) });
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

export interface ReconDetailItem {
  orderId: string | null; externalRef?: string;
  localStatus: string; upstreamStatus: string;
  status: "MATCHED" | "STATUS_DIFF" | "MISSING_LOCAL" | "MISSING_REMOTE";
  expectedMinor: bigint; actualMinor: bigint;
}

function statusClass(s: string): "SUCCESS" | "FAILED" | "OPEN" {
  if (s === "SUCCESS") return "SUCCESS";
  if (["FAILED", "CANCELLED", "REFUNDED"].includes(s)) return "FAILED";
  return "OPEN";
}

/**
 * Đối soát HTTP_CHARGING: với mỗi giao dịch CREATE trong kỳ, gọi command=check ở upstream
 * và so lớp trạng thái với đơn nội bộ. Đơn nội bộ đã chốt (SUCCESS/FAILED) mà upstream khác
 * lớp -> STATUS_DIFF; cả hai cùng lớp (kể cả cùng đang mở) -> MATCHED.
 */
export async function reconcileHttpChargingDetail(db: DB, provider: any, period: { from: Date; to: Date }): Promise<{ total: number; matched: number; items: ReconDetailItem[] }> {
  const txns = await db.providerTransaction.findMany({
    where: { providerId: provider.id, action: "CREATE", createdAt: { gte: period.from, lte: period.to } },
  });
  const items: ReconDetailItem[] = [];
  let matched = 0;
  for (const t of txns) {
    const order = t.orderId ? await db.order.findUnique({ where: { id: t.orderId } }) : null;
    if (!order) {
      items.push({ orderId: t.orderId, externalRef: t.externalRef ?? undefined, localStatus: "NONE", upstreamStatus: "UNKNOWN", status: "MISSING_LOCAL", expectedMinor: 0n, actualMinor: 0n });
      continue;
    }
    let upstreamClass: "SUCCESS" | "FAILED" | "OPEN" = "OPEN";
    let upstreamRaw = "UNKNOWN";
    try {
      const st = await HttpChargingAdapter.getOrderStatus(db, t.externalRef ?? order.id);
      upstreamRaw = st.rawStatus ?? st.status;
      upstreamClass = st.status === "SUCCESS" ? "SUCCESS" : st.status === "FAILED" ? "FAILED" : "OPEN";
    } catch { /* không gọi được upstream -> giữ OPEN, không kết luận lệch */ }
    const localClass = statusClass(order.status);
    const isMatch = localClass === upstreamClass;
    if (isMatch) matched++;
    items.push({
      orderId: order.id, externalRef: t.externalRef ?? undefined,
      localStatus: order.status, upstreamStatus: upstreamRaw,
      status: isMatch ? "MATCHED" : "STATUS_DIFF",
      expectedMinor: order.totalMinor as bigint, actualMinor: order.totalMinor as bigint,
    });
  }
  return { total: txns.length, matched, items };
}
