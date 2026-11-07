import { hmacSha256Hex, maskSecret, sha256Hex, timingSafeEqualHex } from "@/lib/crypto";
import { getNumberSetting } from "./settings";
import { HttpChargingAdapter } from "./http-charging";
import type { DB } from "./ledger";

// Provider adapter contract (doc 07). Method không hỗ trợ -> UNSUPPORTED rõ ràng.
// Không đánh dấu SUCCESS chỉ vì HTTP 200: trạng thái lấy từ body/kết quả nghiệp vụ của adapter.
// Timeout sau submit -> UNKNOWN; inquiry trước khi retry.

export type ProviderOrderStatus = "SUCCESS" | "FAILED" | "PENDING" | "PROCESSING" | "UNKNOWN" | "UNSUPPORTED";

export interface ValidatePlayerResult { valid: boolean; playerName?: string; reason?: string }
export interface CreateOrderResult {
  status: ProviderOrderStatus;
  externalRef?: string;
  costMinor?: bigint;
  rawStatus?: string;
  message?: string;
  latencyMs?: number;
  /** Mệnh giá THẬT được upstream chấp nhận (status 2 sai mệnh giá của chargingws). */
  acceptedValueMinor?: bigint;
}

export interface ChargingCardInput { carrier: string; serial: string; pin: string; faceValueMinor: bigint }

export interface ProviderAdapter {
  code: string;
  authenticate(db: DB): Promise<boolean>;
  getBalance(db: DB): Promise<{ balanceMinor: bigint; currency: string } | "UNSUPPORTED">;
  getCatalog(db: DB): Promise<unknown>;
  getProducts(db: DB): Promise<unknown>;
  getPrice(db: DB, externalSku: string): Promise<bigint | "UNSUPPORTED">;
  validatePlayer(db: DB, input: { productId: string; playerId: string; region?: string; server?: string }): Promise<ValidatePlayerResult | "UNSUPPORTED">;
  createOrder(db: DB, input: { orderId: string; externalSku?: string; playerId?: string; amountMinor: bigint; variantId?: string; card?: ChargingCardInput }): Promise<CreateOrderResult>;
  getOrderStatus(db: DB, externalRef: string): Promise<CreateOrderResult>;
  cancelOrder(db: DB, externalRef: string): Promise<{ cancelled: boolean } | "UNSUPPORTED">;
  processWebhook(db: DB, payload: unknown, signatureOk: boolean): Promise<{ eventId: string; status: ProviderOrderStatus; externalRef?: string } | "UNSUPPORTED">;
  reconcile(db: DB, period: { from: Date; to: Date }): Promise<{ total: number; matched: number } | "UNSUPPORTED">;
}

// ---------------- MockProvider (sandbox) ----------------
// Kịch bản theo hậu tố UID/mệnh giá để test:
//  - UID kết thúc "000" -> FAILED (sai UID)
//  - UID kết thúc "999" -> UNKNOWN ở create, inquiry trả SUCCESS (mô phỏng mạng chập chờn đã nạp thành công)
//  - UID kết thúc "555" -> PENDING ở create, inquiry trả SUCCESS
//  - còn lại -> SUCCESS ngay.
export const MockProvider: ProviderAdapter = {
  code: "MOCK",
  async authenticate() { return true; },
  async getBalance() { return { balanceMinor: 999_000_000n, currency: "VND" }; },
  async getCatalog(db) { return db.providerProduct.findMany({ where: { provider: undefined } }).catch(() => []); },
  async getProducts(db) {
    const p = await db.provider.findUnique({ where: { code: "MOCK" } });
    if (!p) return [];
    return db.providerProduct.findMany({ where: { providerId: p.id } });
  },
  async getPrice(db, externalSku) {
    const p = await db.provider.findUnique({ where: { code: "MOCK" } });
    if (!p) return "UNSUPPORTED";
    const pp = await db.providerProduct.findUnique({ where: { providerId_externalSku: { providerId: p.id, externalSku } } });
    return pp ? (pp.costMinor as bigint) : "UNSUPPORTED";
  },
  async validatePlayer(_db, input) {
    if (!input.playerId || input.playerId.trim().length < 3) return { valid: false, reason: "PLAYER_INVALID" };
    if (input.playerId.endsWith("000")) return { valid: false, reason: "PLAYER_INVALID" };
    return { valid: true, playerName: `Player_${input.playerId.slice(-4)}` };
  },
  async createOrder(_db, input) {
    const started = Date.now();
    const uid = input.playerId ?? "";
    const latencyMs = Date.now() - started + 12;
    if (uid.endsWith("000")) return { status: "FAILED", rawStatus: "PLAYER_NOT_FOUND", message: "UID không tồn tại (mock)", latencyMs };
    if (uid.endsWith("999")) return { status: "UNKNOWN", externalRef: `MOCK-${input.orderId}`, rawStatus: "TIMEOUT_AFTER_SUBMIT", message: "Timeout sau submit (mock) — cần inquiry", latencyMs };
    if (uid.endsWith("555")) return { status: "PENDING", externalRef: `MOCK-${input.orderId}`, rawStatus: "ACCEPTED", message: "Đã tiếp nhận (mock)", latencyMs };
    return { status: "SUCCESS", externalRef: `MOCK-${input.orderId}`, rawStatus: "COMPLETED", latencyMs };
  },
  async getOrderStatus(_db, externalRef) {
    // Inquiry: các đơn UNKNOWN/PENDING của mock đều đã nạp thành công ở phía provider.
    return { status: "SUCCESS", externalRef, rawStatus: "COMPLETED" };
  },
  async cancelOrder() { return "UNSUPPORTED"; },
  async processWebhook(_db, payload: any) {
    return {
      eventId: String(payload?.event_id ?? ""),
      status: (payload?.status as ProviderOrderStatus) ?? "UNKNOWN",
      externalRef: payload?.external_ref,
    };
  },
  async reconcile() { return { total: 0, matched: 0 }; },
};

// ---------------- ManualProvider ----------------
// Mọi thao tác chờ nhân viên vận hành xác nhận ở Admin (exchange queue / top-up orders).
export const ManualProvider: ProviderAdapter = {
  code: "MANUAL",
  async authenticate() { return true; },
  async getBalance() { return "UNSUPPORTED"; },
  async getCatalog() { return []; },
  async getProducts() { return []; },
  async getPrice() { return "UNSUPPORTED"; },
  async validatePlayer() { return "UNSUPPORTED"; },
  async createOrder(_db, input) {
    return { status: "PENDING", externalRef: `MANUAL-${input.orderId}`, rawStatus: "QUEUED_MANUAL", message: "Chờ nhân viên xử lý thủ công" };
  },
  async getOrderStatus() { return { status: "PENDING", rawStatus: "QUEUED_MANUAL" }; },
  async cancelOrder() { return { cancelled: true }; },
  async processWebhook() { return "UNSUPPORTED"; },
  async reconcile() { return "UNSUPPORTED"; },
};

export function getAdapter(code: string): ProviderAdapter {
  if (code === "MOCK") return MockProvider;
  if (code === "MANUAL") return ManualProvider;
  if (code === "HTTP_CHARGING") return HttpChargingAdapter;
  throw new Error(`PROVIDER_ADAPTER_NOT_IMPLEMENTED:${code}`);
}

// ---------------- Circuit breaker + health ----------------
export async function isCircuitOpen(db: DB, providerId: string): Promise<boolean> {
  const latest = await db.providerHealthMetric.findFirst({ where: { providerId }, orderBy: { createdAt: "desc" } });
  if (!latest || latest.circuitState === "CLOSED") return false;
  if (latest.circuitState === "OPEN") {
    const cooldown = await getNumberSetting("provider.circuit_cooldown_seconds", 120);
    if (latest.circuitOpenedAt && Date.now() - latest.circuitOpenedAt.getTime() > cooldown * 1000) return false; // -> HALF_OPEN cho thử
    return true;
  }
  return false; // HALF_OPEN: cho qua 1 lượt thử
}

export async function recordProviderResult(db: DB, providerId: string, result: { status: ProviderOrderStatus; latencyMs?: number }) {
  const threshold = await getNumberSetting("provider.circuit_fail_threshold", 5);
  const latest = await db.providerHealthMetric.findFirst({ where: { providerId }, orderBy: { createdAt: "desc" } });
  const failed = result.status === "FAILED" || result.status === "UNKNOWN";
  const consecutiveFails = failed ? (latest?.consecutiveFails ?? 0) + 1 : 0;
  const circuitState = consecutiveFails >= threshold ? "OPEN" : "CLOSED";
  await db.providerHealthMetric.create({
    data: {
      providerId,
      windowStart: new Date(),
      total: 1,
      success: result.status === "SUCCESS" ? 1 : 0,
      failed: result.status === "FAILED" ? 1 : 0,
      unknown: result.status === "UNKNOWN" ? 1 : 0,
      avgLatencyMs: result.latencyMs ?? 0,
      circuitState,
      consecutiveFails,
      circuitOpenedAt: circuitState === "OPEN" ? new Date() : latest?.circuitOpenedAt ?? null,
    },
  });
  return circuitState;
}

// ---------------- Routing ----------------
export interface RouteDecision {
  provider: any;
  providerProduct: any | null;
  costMinor: bigint;
  reason: string;
}

/**
 * Lọc theo capability/stock/status/circuit → xếp hạng priority/cost/success-rate.
 * Trả null nếu không có nguồn phù hợp (caller xử lý PROVIDER_UNAVAILABLE hoặc chuyển MANUAL tuỳ luồng).
 */
export async function routeProvider(
  db: DB,
  params: { productType: string; region?: string; currency?: string; variantId?: string }
): Promise<RouteDecision | null> {
  const providers = await db.provider.findMany({ where: { status: "ACTIVE" }, orderBy: { priority: "asc" } });
  const candidates: RouteDecision[] = [];
  for (const p of providers) {
    const cap = await db.providerCapability.findFirst({
      where: { providerId: p.id, productType: params.productType, region: params.region ?? "VN", currency: params.currency ?? "VND", supported: true },
    });
    if (!cap) continue;
    if (await isCircuitOpen(db, p.id)) continue;
    let pp: any = null;
    let cost = 0n;
    if (params.variantId) {
      pp = await db.providerProduct.findFirst({ where: { providerId: p.id, variantId: params.variantId, isActive: true } });
      if (pp) {
        if (pp.stock != null && pp.stock <= 0) continue;
        cost = pp.costMinor as bigint;
      } else if (p.code !== "MANUAL") {
        continue; // provider API/mock không có mapping SKU -> bỏ qua
      }
    }
    candidates.push({ provider: p, providerProduct: pp, costMinor: cost, reason: `priority=${p.priority} cost=${cost.toString()} capability=OK circuit=CLOSED` });
  }
  candidates.sort((a, b) => (a.provider.priority - b.provider.priority) || (a.costMinor < b.costMinor ? -1 : a.costMinor > b.costMinor ? 1 : 0));
  return candidates[0] ?? null;
}

// ---------------- Webhook chữ ký ----------------
export function verifyProviderSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = hmacSha256Hex(secret, rawBody);
  return timingSafeEqualHex(expected, signature.toLowerCase());
}

export function payloadHash(rawBody: string) { return sha256Hex(rawBody); }
export { maskSecret };
