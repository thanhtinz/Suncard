import { prisma } from "@/lib/prisma";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";
import { postDeposit, ensureWallet, type DB } from "./ledger";
import { enqueueWebhookEvent } from "./webhooks";
import { notifyUser } from "./audit";

// Payment intents + MockPay callback có chữ ký (bản demo/sandbox — KHÔNG phải cổng thanh toán thật).
// Nạp thủ công qua maker-checker nằm ở luồng deposits (API admin finance decision).

export async function createDepositIntent(userId: string, amountMinor: bigint, method = "MOCKPAY") {
  if (amountMinor <= 0n) throw new Error("VALIDATION_AMOUNT");
  // PAY-06 velocity: giới hạn số intent mỗi giờ (settings)
  const { getNumberSetting } = await import("./settings");
  const maxPerHour = await getNumberSetting("payments.max_intents_per_hour", 20);
  const recent = await prisma.paymentIntent.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 3600000) } } });
  if (recent >= maxPerHour) throw new Error("RATE_LIMITED");
  const intent = await prisma.paymentIntent.create({
    data: { userId, purpose: "DEPOSIT", amountMinor, method, status: "CREATED", expiresAt: new Date(Date.now() + 30 * 60000) },
  });
  return intent;
}

export function mockPaySignature(intentId: string, status: string): string {
  const secret = process.env.PROVIDER_WEBHOOK_SECRET || "dev-provider-secret";
  return hmacSha256Hex(secret, `${intentId}.${status}`);
}

export function verifyMockPaySignature(intentId: string, status: string, signature: string): boolean {
  return timingSafeEqualHex(mockPaySignature(intentId, status), signature.toLowerCase());
}

/** Xử lý callback MockPay: verify chữ ký, idempotent theo trạng thái intent, PAID -> tạo deposit đã duyệt + post ledger. */
export async function handleMockPayCallback(params: { intentId: string; status: string; signature: string; externalRef?: string }) {
  if (!verifyMockPaySignature(params.intentId, params.status, params.signature)) throw new Error("SIGNATURE_INVALID");
  const intent = await prisma.paymentIntent.findUnique({ where: { id: params.intentId } });
  if (!intent) throw new Error("NOT_FOUND");
  if (intent.status === "PAID") return { intent, duplicated: true };
  if (params.status !== "PAID") {
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "FAILED", externalRef: params.externalRef } });
    return { intent, duplicated: false };
  }
  const result = await prisma.$transaction(async (tx) => {
    const db = tx as DB;
    await ensureWallet(db, intent.userId);
    const deposit = await tx.deposit.create({
      data: {
        userId: intent.userId, method: "MOCKPAY", amountMinor: intent.amountMinor, status: "APPROVED",
        reference: params.externalRef ?? intent.id, makerId: "system:mockpay", checkerId: "system:mockpay",
        idempotencyKey: `mockpay:${intent.id}`,
      },
    });
    const posted = await postDeposit(db, { userId: intent.userId, amountMinor: intent.amountMinor as bigint, depositId: deposit.id, createdBy: "system:mockpay" });
    await tx.deposit.update({ where: { id: deposit.id }, data: { ledgerTxId: posted.tx.id } });
    await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: "PAID", externalRef: params.externalRef } });
    return deposit;
  });
  await enqueueWebhookEvent(prisma as unknown as DB, {
    eventType: "wallet.deposit.success", resourceId: result.id, userId: intent.userId,
    data: { deposit_id: result.id, amount_minor: (intent.amountMinor as bigint).toString(), currency: "VND" },
  });
  await notifyUser(prisma as unknown as DB, { userId: intent.userId, type: "DEPOSIT_SUCCESS", title: "Nạp tiền thành công", resourceType: "DEPOSIT", resourceId: result.id });
  return { intent, deposit: result, duplicated: false };
}
