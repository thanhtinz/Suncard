import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth } from "@/modules/security";
import { getNumberSetting } from "@/modules/settings";
import { ensureWallet, holdFunds, type DB } from "@/modules/ledger";

// Rút tiền: kiểm KYC + hold tiền ngay khi tạo request -> maker-checker duyệt ở Admin.
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const b = await readJson(req);
    const amount = BigInt(b.amountMinor ?? "0");
    const min = BigInt(await getNumberSetting("wallet.min_withdraw_minor", 50000));
    if (amount < min) throw new Error("VALIDATION_MIN_WITHDRAW");
    const user = await prisma.user.findUnique({ where: { id: s.userId } });
    if (!user) throw new Error("AUTH_INVALID");
    if (user.kycStatus !== "VERIFIED") throw new Error("VALIDATION_KYC_REQUIRED");
    const fee = BigInt(await getNumberSetting("wallet.withdraw_fee_minor", 0));
    const key = b.idempotencyKey ?? `wd:${s.userId}:${Date.now()}`;
    const result = await prisma.$transaction(async (tx) => {
      const db = tx as DB;
      await ensureWallet(db, s.userId);
      const w = await tx.withdrawalRequest.create({
        data: { userId: s.userId, amountMinor: amount, feeMinor: fee, bankInfo: b.bankInfo, status: "PENDING", makerId: s.userId, idempotencyKey: key },
      });
      const { hold } = await holdFunds(db, { userId: s.userId, amountMinor: amount + fee, idempotencyKey: `wd-hold:${w.id}` });
      await tx.withdrawalRequest.update({ where: { id: w.id }, data: { holdId: hold.id } });
      await tx.financialApprovalRequest.create({ data: { kind: "WITHDRAWAL", refId: w.id, amountMinor: amount, makerId: s.userId, payload: { withdrawalId: w.id } } });
      return w;
    });
    return ok(serialize({ withdrawal: result }), 201);
  } catch (e) { return fail(e); }
}
export async function GET() {
  try {
    const s = await requireAuth();
    const list = await prisma.withdrawalRequest.findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" }, take: 50 });
    return ok(serialize({ withdrawals: list }));
  } catch (e) { return fail(e); }
}
