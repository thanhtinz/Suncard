import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, ApiError } from "@/modules/security";
import { postLedger, walletAvailableCode, ensureWallet, type DB } from "@/modules/ledger";
import { bpsOf } from "@/lib/money";
import { getNumberSetting } from "@/modules/settings";

export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const b = await readJson(req);
    const amount = BigInt(b.amountMinor ?? "0");
    if (amount <= 0n) throw new Error("VALIDATION_AMOUNT");
    const to = await prisma.user.findUnique({ where: { email: b.toEmail } });
    if (!to) throw new ApiError("NOT_FOUND", 404, "Người nhận không tồn tại");
    if (to.id === s.userId) throw new Error("VALIDATION_SELF_TRANSFER");
    const key = b.idempotencyKey ?? `tr:${s.userId}:${Date.now()}`;
    const transfer = await prisma.$transaction(async (tx) => {
      const db = tx as DB;
      const dup = await tx.walletTransfer.findUnique({ where: { fromUserId_idempotencyKey: { fromUserId: s.userId, idempotencyKey: key } } });
      if (dup) return dup;
      await ensureWallet(db, s.userId);
      await ensureWallet(db, to.id);
      const feeBps = await getNumberSetting("wallet.transfer_fee_bps", 0);
      const fee = bpsOf(amount, feeBps);
      const entries: any[] = [
        { accountCode: walletAvailableCode(s.userId), ownerType: "USER", ownerId: s.userId, kind: "AVAILABLE", direction: "DEBIT", amountMinor: amount + fee },
        { accountCode: walletAvailableCode(to.id), ownerType: "USER", ownerId: to.id, kind: "AVAILABLE", direction: "CREDIT", amountMinor: amount },
      ];
      if (fee > 0n) entries.push({ accountCode: "PLATFORM:MARGIN", ownerType: "PLATFORM", kind: "REVENUE", direction: "CREDIT", amountMinor: fee });
      else entries[0].amountMinor = amount;
      // Kiểm tra số dư qua ledger account projection
      const acc = await tx.ledgerAccount.findUnique({ where: { code: walletAvailableCode(s.userId) } });
      if (!acc || (acc.balanceMinor as bigint) < amount + fee) throw new Error("INSUFFICIENT_BALANCE");
      const posted = await postLedger(db, { type: "TRANSFER", refType: "TRANSFER", idempotencyKey: `transfer:${s.userId}:${key}`, description: b.note ?? "Chuyển ví nội bộ", entries });
      return tx.walletTransfer.create({ data: { fromUserId: s.userId, toUserId: to.id, amountMinor: amount, feeMinor: fee, note: b.note, idempotencyKey: key, ledgerTxId: posted.tx.id } });
    });
    return ok(serialize({ transfer }), 201);
  } catch (e) { return fail(e); }
}
