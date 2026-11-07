import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk, idempotencyKeyOf } from "@/lib/partner";
import { ApiError } from "@/modules/security";
import { postLedger, walletAvailableCode, ensureWallet, type DB } from "@/modules/ledger";
export async function POST(req: Request) {
  return withPartner(req, async ({ userId, body }) => {
    const key = idempotencyKeyOf(req, body);
    const to = await prisma.user.findUnique({ where: { email: body.to_email } });
    if (!to) throw new ApiError("NOT_FOUND", 404, "Người nhận không tồn tại");
    const amount = BigInt(body.amount_minor ?? "0");
    const transfer = await prisma.$transaction(async (tx) => {
      const db = tx as DB;
      const dup = await tx.walletTransfer.findUnique({ where: { fromUserId_idempotencyKey: { fromUserId: userId!, idempotencyKey: key } } });
      if (dup) return dup;
      await ensureWallet(db, userId!); await ensureWallet(db, to.id);
      const acc = await tx.ledgerAccount.findUnique({ where: { code: walletAvailableCode(userId!) } });
      if (!acc || (acc.balanceMinor as bigint) < amount) throw new ApiError("INSUFFICIENT_BALANCE", 402);
      const posted = await postLedger(db, { type: "TRANSFER", idempotencyKey: `transfer:${userId}:${key}`, entries: [
        { accountCode: walletAvailableCode(userId!), ownerType: "USER", ownerId: userId, kind: "AVAILABLE", direction: "DEBIT", amountMinor: amount },
        { accountCode: walletAvailableCode(to.id), ownerType: "USER", ownerId: to.id, kind: "AVAILABLE", direction: "CREDIT", amountMinor: amount },
      ] });
      return tx.walletTransfer.create({ data: { fromUserId: userId!, toUserId: to.id, amountMinor: amount, idempotencyKey: key, ledgerTxId: posted.tx.id } });
    });
    return partnerOk({ transfer: { id: transfer.id, amount_minor: transfer.amountMinor.toString() } }, 201);
  });
}
