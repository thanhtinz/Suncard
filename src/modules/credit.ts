import type { DB } from "./ledger";

// Công nợ (doc 03): available = limit − outstanding − reserved.
// Điều chỉnh hạn mức phải maker-checker (tầng API tạo FinancialApprovalRequest).

export async function ensureCreditAccount(db: DB, userId: string, agentId?: string | null) {
  return db.creditAccount.upsert({
    where: { userId },
    create: { userId, agentId: agentId ?? undefined },
    update: {},
  });
}

export function creditAvailable(acc: { limitMinor: bigint; outstandingMinor: bigint; reservedMinor: bigint }): bigint {
  return (acc.limitMinor as bigint) - (acc.outstandingMinor as bigint) - (acc.reservedMinor as bigint);
}

export async function assertCreditAvailable(db: DB, userId: string, amountMinor: bigint) {
  const acc = await db.creditAccount.findUnique({ where: { userId } });
  if (!acc || acc.status !== "ACTIVE") throw new Error("CREDIT_LIMIT_EXCEEDED");
  if (creditAvailable(acc) < amountMinor) throw new Error("CREDIT_LIMIT_EXCEEDED");
  return acc;
}

export async function reserveCredit(db: DB, params: { userId: string; amountMinor: bigint; refId: string; idempotencyKey: string }) {
  const existing = await db.creditTransaction.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
  if (existing) return existing;
  const acc = await assertCreditAvailable(db, params.userId, params.amountMinor);
  await db.creditAccount.update({
    where: { id: acc.id },
    data: { reservedMinor: (acc.reservedMinor as bigint) + params.amountMinor },
  });
  return db.creditTransaction.create({
    data: { creditAccountId: acc.id, type: "RESERVE", amountMinor: params.amountMinor, refType: "ORDER", refId: params.refId, idempotencyKey: params.idempotencyKey },
  });
}

export async function settleCredit(db: DB, params: { userId: string; amountMinor: bigint; refId: string; idempotencyKey: string }) {
  const existing = await db.creditTransaction.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
  if (existing) return existing;
  const acc = await db.creditAccount.findUnique({ where: { userId: params.userId } });
  if (!acc) throw new Error("CREDIT_ACCOUNT_NOT_FOUND");
  await db.creditAccount.update({
    where: { id: acc.id },
    data: {
      reservedMinor: (acc.reservedMinor as bigint) - params.amountMinor,
      outstandingMinor: (acc.outstandingMinor as bigint) + params.amountMinor,
    },
  });
  return db.creditTransaction.create({
    data: { creditAccountId: acc.id, type: "DRAW", amountMinor: params.amountMinor, refType: "ORDER", refId: params.refId, idempotencyKey: params.idempotencyKey },
  });
}

export async function releaseCredit(db: DB, params: { userId: string; amountMinor: bigint; refId: string; idempotencyKey: string }) {
  const existing = await db.creditTransaction.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
  if (existing) return existing;
  const acc = await db.creditAccount.findUnique({ where: { userId: params.userId } });
  if (!acc) return null;
  await db.creditAccount.update({
    where: { id: acc.id },
    data: { reservedMinor: (acc.reservedMinor as bigint) - params.amountMinor },
  });
  return db.creditTransaction.create({
    data: { creditAccountId: acc.id, type: "RELEASE", amountMinor: params.amountMinor, refType: "ORDER", refId: params.refId, idempotencyKey: params.idempotencyKey },
  });
}

export async function repayCredit(db: DB, params: { userId: string; amountMinor: bigint; idempotencyKey: string; createdBy?: string }) {
  const existing = await db.creditTransaction.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
  if (existing) return existing;
  const acc = await db.creditAccount.findUnique({ where: { userId: params.userId } });
  if (!acc) throw new Error("CREDIT_ACCOUNT_NOT_FOUND");
  const pay = params.amountMinor > (acc.outstandingMinor as bigint) ? (acc.outstandingMinor as bigint) : params.amountMinor;
  await db.creditAccount.update({
    where: { id: acc.id },
    data: { outstandingMinor: (acc.outstandingMinor as bigint) - pay },
  });
  return db.creditTransaction.create({
    data: { creditAccountId: acc.id, type: "REPAY", amountMinor: pay, idempotencyKey: params.idempotencyKey, createdBy: params.createdBy },
  });
}
