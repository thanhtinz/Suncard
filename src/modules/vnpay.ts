import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getSetting } from "./settings";
import { postDeposit, ensureWallet, type DB } from "./ledger";
import { enqueueWebhookEvent } from "./webhooks";
import { notifyUser } from "./audit";

// ============================================================================
// Cổng nạp VNPay (Phase 3) — theo đặc tả công khai VNPay (payment gateway 2.1.0):
// - Tạo URL thanh toán: tham số vnp_* sắp xếp theo key, secure hash = HMAC-SHA512
//   trên chuỗi query đã encode (key=value&...), vnp_Amount = số tiền (VND) x 100.
// - IPN (server-to-server) là nguồn SỰ THẬT duy nhất để cộng ví: verify chữ ký,
//   khớp TmnCode + số tiền, cộng đúng 1 lần qua ledger. Return URL chỉ để hiển thị,
//   TUYỆT ĐỐI không cộng tiền theo trạng thái phía client (PAY-01).
// - IPN đã xác thực KHÔNG qua maker-checker (khác nạp thủ công).
// - Cấu hình ở Admin -> Cài đặt (nhóm vnpay); hash secret lưu MÃ HOÁ AES-GCM qua
//   API riêng /api/admin/payments/vnpay-secret. Thiếu bất kỳ cấu hình nào = tắt.
// ============================================================================

export interface VnpayConfig {
  tmnCode: string;
  hashSecret: string;
  payUrl: string;
  returnUrl: string;
}

export async function getVnpayConfig(): Promise<VnpayConfig | null> {
  const enabled = await getSetting<boolean>("vnpay.enabled", false);
  const tmnCode = String(await getSetting<string>("vnpay.tmn_code", ""));
  const secretEnc = String(await getSetting<string>("vnpay.hash_secret_enc", ""));
  const payUrl = String(await getSetting<string>("vnpay.pay_url", "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"));
  const returnUrl = String(await getSetting<string>("vnpay.return_url", ""));
  if (!enabled || !tmnCode || !secretEnc) return null;
  let hashSecret: string;
  try { hashSecret = decryptSecret(secretEnc); } catch { return null; }
  if (!hashSecret) return null;
  return { tmnCode, hashSecret, payUrl, returnUrl };
}

export async function vnpayEnabled(): Promise<boolean> {
  return (await getVnpayConfig()) !== null;
}

/** Ghi hash secret dạng mã hoá (dùng bởi API admin riêng, có audit ở tầng route). */
export function encryptVnpaySecret(plain: string): string {
  return encryptSecret(plain);
}

/** Chuỗi ký: tham số (đã loại vnp_SecureHash/vnp_SecureHashType) sắp xếp theo key, encodeURIComponent từng cặp. */
export function vnpaySignData(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k.startsWith("vnp_") && k !== "vnp_SecureHash" && k !== "vnp_SecureHashType" && params[k] !== "" && params[k] != null)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");
}

export function vnpaySecureHash(hashSecret: string, params: Record<string, string>): string {
  return crypto.createHmac("sha512", hashSecret).update(vnpaySignData(params), "utf-8").digest("hex");
}

export function verifyVnpaySignature(hashSecret: string, params: Record<string, string>): boolean {
  const got = (params.vnp_SecureHash ?? "").toLowerCase();
  if (!got) return false;
  const expected = vnpaySecureHash(hashSecret, params);
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Định dạng thời gian VNPay: yyyyMMddHHmmss theo giờ Việt Nam (UTC+7). */
export function vnpayDate(d = new Date()): string {
  const vn = new Date(d.getTime() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${vn.getUTCFullYear()}${p(vn.getUTCMonth() + 1)}${p(vn.getUTCDate())}${p(vn.getUTCHours())}${p(vn.getUTCMinutes())}${p(vn.getUTCSeconds())}`;
}

export function buildVnpayPaymentUrl(cfg: VnpayConfig, params: {
  txnRef: string; amountMinor: bigint; ipAddr: string; orderInfo: string; returnUrl: string; expireMinutes?: number;
}): string {
  const now = new Date();
  const p: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: cfg.tmnCode,
    vnp_Amount: (params.amountMinor * 100n).toString(),
    vnp_CurrCode: "VND",
    vnp_TxnRef: params.txnRef,
    vnp_OrderInfo: params.orderInfo,
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: params.returnUrl,
    vnp_IpAddr: params.ipAddr || "127.0.0.1",
    vnp_CreateDate: vnpayDate(now),
    vnp_ExpireDate: vnpayDate(new Date(now.getTime() + (params.expireMinutes ?? 15) * 60000)),
  };
  const hash = vnpaySecureHash(cfg.hashSecret, p);
  const qs = `${vnpaySignData(p)}&vnp_SecureHash=${hash}`;
  return `${cfg.payUrl}?${qs}`;
}

/**
 * Tạo intent + deposit PENDING_GATEWAY cho một lần nạp VNPay.
 * TxnRef = id của PaymentIntent (duy nhất, alphanumeric).
 */
export async function createVnpayDeposit(userId: string, amountMinor: bigint, baseReturnUrl: string) {
  const cfg = await getVnpayConfig();
  if (!cfg) throw new Error("VNPAY_DISABLED");
  if (amountMinor <= 0n) throw new Error("VALIDATION_AMOUNT");
  const { getNumberSetting } = await import("./settings");
  const maxPerHour = await getNumberSetting("payments.max_intents_per_hour", 20);
  const recent = await prisma.paymentIntent.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 3600000) } } });
  if (recent >= maxPerHour) throw new Error("RATE_LIMITED");
  const intent = await prisma.paymentIntent.create({
    data: { userId, purpose: "DEPOSIT", amountMinor, method: "VNPAY", status: "CREATED", expiresAt: new Date(Date.now() + 15 * 60000) },
  });
  const deposit = await prisma.deposit.create({
    data: {
      userId, method: "VNPAY", amountMinor, status: "PENDING_GATEWAY",
      reference: intent.id, makerId: "system:vnpay", idempotencyKey: `vnpay:${intent.id}`,
    },
  });
  const returnUrl = cfg.returnUrl || baseReturnUrl;
  const url = buildVnpayPaymentUrl(cfg, {
    txnRef: intent.id, amountMinor, ipAddr: "127.0.0.1",
    orderInfo: `Nap vi SunCard ${intent.id}`, returnUrl,
  });
  return { intent, deposit, url };
}

export interface VnpayIpnResult { rspCode: string; message: string; credited: boolean; duplicated?: boolean }

/**
 * Xử lý IPN VNPay — verify chữ ký TRƯỚC, khớp mã đơn + số tiền, cộng ví đúng 1 lần.
 * Mã trả về theo đặc tả VNPay: 00 xác nhận, 01 không thấy đơn, 02 đã xác nhận trước đó,
 * 04 số tiền không khớp, 97 chữ ký không hợp lệ, 99 lỗi khác.
 */
export async function handleVnpayIpn(query: Record<string, string>): Promise<VnpayIpnResult> {
  const cfg = await getVnpayConfig();
  if (!cfg) return { rspCode: "99", message: "VNPay chưa cấu hình", credited: false };
  if (!verifyVnpaySignature(cfg.hashSecret, query)) return { rspCode: "97", message: "Chữ ký không hợp lệ", credited: false };
  if (query.vnp_TmnCode !== cfg.tmnCode) return { rspCode: "99", message: "TmnCode không khớp", credited: false };
  const txnRef = query.vnp_TxnRef ?? "";
  const intent = await prisma.paymentIntent.findUnique({ where: { id: txnRef } });
  if (!intent || intent.method !== "VNPAY") return { rspCode: "01", message: "Không tìm thấy giao dịch", credited: false };
  if (intent.status === "PAID") return { rspCode: "02", message: "Giao dịch đã được xác nhận trước đó", credited: false, duplicated: true };
  const paidAmount = (() => { try { return BigInt(query.vnp_Amount ?? "0") / 100n; } catch { return -1n; } })();
  if (paidAmount !== (intent.amountMinor as bigint)) return { rspCode: "04", message: "Số tiền không khớp", credited: false };

  const success = query.vnp_ResponseCode === "00" && (query.vnp_TransactionStatus ?? "00") === "00";
  if (!success) {
    await prisma.$transaction(async (tx) => {
      await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: "FAILED", externalRef: query.vnp_TransactionNo } });
      await tx.deposit.updateMany({ where: { idempotencyKey: `vnpay:${intent.id}`, status: "PENDING_GATEWAY" }, data: { status: "REJECTED", note: `VNPay response ${query.vnp_ResponseCode ?? ""}` } });
    });
    return { rspCode: "00", message: "Đã ghi nhận trạng thái thất bại", credited: false };
  }

  // Thành công: cộng ví đúng 1 lần (claim nguyên tử bằng điều kiện status trong updateMany).
  const deposit = await prisma.$transaction(async (tx) => {
    const db = tx as DB;
    const claim = await tx.paymentIntent.updateMany({ where: { id: intent.id, status: "CREATED" }, data: { status: "PAID", externalRef: query.vnp_TransactionNo } });
    if (claim.count === 0) return null; // instance khác đã xử lý
    await ensureWallet(db, intent.userId);
    const dep = await tx.deposit.findUnique({ where: { userId_idempotencyKey: { userId: intent.userId, idempotencyKey: `vnpay:${intent.id}` } } });
    if (!dep) throw new Error("DEPOSIT_NOT_FOUND");
    const posted = await postDeposit(db, { userId: intent.userId, amountMinor: intent.amountMinor as bigint, depositId: dep.id, createdBy: "system:vnpay" });
    await tx.deposit.update({ where: { id: dep.id }, data: { status: "APPROVED", checkerId: "system:vnpay-ipn", ledgerTxId: posted.tx.id } });
    return dep;
  });
  if (!deposit) return { rspCode: "02", message: "Giao dịch đã được xác nhận trước đó", credited: false, duplicated: true };
  await enqueueWebhookEvent(prisma as unknown as DB, {
    eventType: "wallet.deposit.success", resourceId: deposit.id, userId: intent.userId,
    data: { deposit_id: deposit.id, amount_minor: (intent.amountMinor as bigint).toString(), currency: "VND", method: "VNPAY" },
  });
  await notifyUser(prisma as unknown as DB, { userId: intent.userId, type: "DEPOSIT_SUCCESS", title: "Nạp tiền VNPay thành công", resourceType: "DEPOSIT", resourceId: deposit.id });
  return { rspCode: "00", message: "Xác nhận thành công", credited: true };
}
