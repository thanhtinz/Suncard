import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth } from "@/modules/security";
import { getNumberSetting } from "@/modules/settings";
import { createDepositIntent, mockPaySignature } from "@/modules/payments";

// Nạp ví: method MOCKPAY -> payment intent + chữ ký callback (sandbox).
// method BANK_TRANSFER -> tạo deposit PENDING + yêu cầu duyệt maker-checker cho Finance/Admin.
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const b = await readJson(req);
    const amount = BigInt(b.amountMinor ?? "0");
    const min = BigInt(await getNumberSetting("wallet.min_deposit_minor", 10000));
    if (amount < min) throw new Error("VALIDATION_MIN_DEPOSIT");
    if ((b.method ?? "BANK_TRANSFER") === "MOCKPAY") {
      const intent = await createDepositIntent(s.userId, amount, "MOCKPAY");
      return ok(serialize({ intent, mockCallback: { url: "/api/payments/mockpay/callback", intentId: intent.id, status: "PAID", signature: mockPaySignature(intent.id, "PAID") } }), 201);
    }
    const deposit = await prisma.deposit.create({
      data: { userId: s.userId, method: "BANK_TRANSFER", amountMinor: amount, status: "PENDING", reference: b.reference, makerId: s.userId, idempotencyKey: b.idempotencyKey ?? `dep:${s.userId}:${Date.now()}` },
    });
    await prisma.financialApprovalRequest.create({
      data: { kind: "DEPOSIT", refId: deposit.id, amountMinor: amount, makerId: s.userId, status: "PENDING", payload: { depositId: deposit.id } },
    });
    return ok(serialize({ deposit }), 201);
  } catch (e) { return fail(e); }
}
export async function GET() {
  try {
    const s = await requireAuth();
    const deposits = await prisma.deposit.findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" }, take: 50 });
    return ok(serialize({ deposits }));
  } catch (e) { return fail(e); }
}
