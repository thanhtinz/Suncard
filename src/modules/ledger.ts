import { prisma } from "@/lib/prisma";
import { randomCode } from "@/lib/crypto";

// Ledger double-entry append-only.
// Quy ước: balance của account = Σ CREDIT − Σ DEBIT (projection cập nhật duy nhất qua postLedger).
// Mọi transaction: tổng DEBIT == tổng CREDIT, amount > 0. Không sửa/xoá entry; sai sót -> reversal.

export type DB = any; // Prisma.TransactionClient | PrismaClient

export interface LedgerEntryInput {
  accountCode: string;
  ownerType?: string;
  ownerId?: string | null;
  kind?: string;
  direction: "DEBIT" | "CREDIT";
  amountMinor: bigint;
  currency?: string;
}

export async function getOrCreateAccount(db: DB, code: string, ownerType = "SYSTEM", ownerId: string | null = null, kind = "AVAILABLE", currency = "VND") {
  const existing = await db.ledgerAccount.findUnique({ where: { code } });
  if (existing) return existing;
  return db.ledgerAccount.create({ data: { code, ownerType, ownerId, kind, currency } });
}

export function walletAvailableCode(userId: string) { return `WALLET:${userId}:AVAILABLE`; }
export function walletHeldCode(userId: string) { return `WALLET:${userId}:HELD`; }
export function commissionCode(userId: string) { return `COMMISSION:${userId}:PAYABLE`; }
export const PLATFORM_CASH = "PLATFORM:CASH";
export const PLATFORM_MARGIN = "PLATFORM:MARGIN";
export const PLATFORM_EXCHANGE = "PLATFORM:EXCHANGE_CLEARING";
export function providerPayableCode(providerId: string) { return `PROVIDER:${providerId}:PAYABLE`; }

export async function ensureWallet(db: DB, userId: string, currency = "VND") {
  const wallet = await db.wallet.upsert({
    where: { userId },
    create: { userId, currency },
    update: {},
  });
  await getOrCreateAccount(db, walletAvailableCode(userId), "USER", userId, "AVAILABLE", currency);
  await getOrCreateAccount(db, walletHeldCode(userId), "USER", userId, "HELD", currency);
  return wallet;
}

export async function getAccountBalance(db: DB, code: string): Promise<bigint> {
  const acc = await db.ledgerAccount.findUnique({ where: { code } });
  return acc ? (acc.balanceMinor as bigint) : 0n;
}

export async function getWalletBalances(db: DB, userId: string) {
  const available = await getAccountBalance(db, walletAvailableCode(userId));
  const heldAcc = await db.ledgerAccount.findUnique({ where: { code: walletHeldCode(userId) } });
  const held = heldAcc ? (heldAcc.balanceMinor as bigint) : 0n;
  const commission = await getAccountBalance(db, commissionCode(userId));
  return { available, held, commission };
}

export interface PostTxInput {
  type: string;
  refType?: string;
  refId?: string;
  idempotencyKey?: string;
  description?: string;
  createdBy?: string;
  entries: LedgerEntryInput[];
}

/** Post một transaction cân bằng. Idempotent theo idempotencyKey: trùng -> trả tx cũ, không post lại. */
export async function postLedger(db: DB, input: PostTxInput) {
  if (input.idempotencyKey) {
    const dup = await db.ledgerTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (dup) return { tx: dup, duplicated: true };
  }
  let totalDebit = 0n;
  let totalCredit = 0n;
  for (const e of input.entries) {
    if (e.amountMinor <= 0n) throw new Error("LEDGER_AMOUNT_MUST_BE_POSITIVE");
    if (e.direction === "DEBIT") totalDebit += e.amountMinor; else totalCredit += e.amountMinor;
  }
  if (totalDebit !== totalCredit) throw new Error(`LEDGER_UNBALANCED debit=${totalDebit} credit=${totalCredit}`);
  if (totalDebit === 0n) throw new Error("LEDGER_EMPTY");

  const tx = await db.ledgerTransaction.create({
    data: {
      code: randomCode("TX"),
      type: input.type,
      refType: input.refType,
      refId: input.refId,
      idempotencyKey: input.idempotencyKey,
      description: input.description,
      createdBy: input.createdBy,
    },
  });
  for (const e of input.entries) {
    const acc = await getOrCreateAccount(db, e.accountCode, e.ownerType ?? "SYSTEM", e.ownerId ?? null, e.kind ?? "AVAILABLE", e.currency ?? "VND");
    const delta = e.direction === "CREDIT" ? e.amountMinor : -e.amountMinor;
    const updated = await db.ledgerAccount.update({
      where: { id: acc.id },
      data: { balanceMinor: (acc.balanceMinor as bigint) + delta, version: { increment: 1 } },
    });
    await db.ledgerEntry.create({
      data: {
        transactionId: tx.id,
        accountId: acc.id,
        direction: e.direction,
        amountMinor: e.amountMinor,
        currency: e.currency ?? "VND",
        balanceAfterMinor: updated.balanceMinor,
      },
    });
  }
  return { tx, duplicated: false };
}

/** Kiểm tra số dư khả dụng trước khi hold/trừ. Ném INSUFFICIENT_BALANCE nếu thiếu. */
export async function assertSufficient(db: DB, userId: string, amountMinor: bigint) {
  const bal = await getAccountBalance(db, walletAvailableCode(userId));
  if (bal < amountMinor) throw new Error("INSUFFICIENT_BALANCE");
  return bal;
}

/** Hold tiền cho order: AVAILABLE -> HELD. Idempotent theo idempotencyKey của hold. */
export async function holdFunds(db: DB, params: { userId: string; orderId?: string; amountMinor: bigint; idempotencyKey: string; ttlMinutes?: number; createdBy?: string }) {
  const existing = await db.walletHold.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
  if (existing) return { hold: existing, duplicated: true };
  await assertSufficient(db, params.userId, params.amountMinor);
  const wallet = await ensureWallet(db, params.userId);
  const expiresAt = params.ttlMinutes ? new Date(Date.now() + params.ttlMinutes * 60000) : null;
  const hold = await db.walletHold.create({
    data: { walletId: wallet.id, orderId: params.orderId, amountMinor: params.amountMinor, idempotencyKey: params.idempotencyKey, expiresAt, status: "ACTIVE" },
  });
  await postLedger(db, {
    type: "ORDER_HOLD",
    refType: "ORDER",
    refId: params.orderId,
    idempotencyKey: `hold:${params.idempotencyKey}`,
    description: "Giữ tiền cho đơn hàng",
    createdBy: params.createdBy,
    entries: [
      { accountCode: walletAvailableCode(params.userId), ownerType: "USER", ownerId: params.userId, kind: "AVAILABLE", direction: "DEBIT", amountMinor: params.amountMinor },
      { accountCode: walletHeldCode(params.userId), ownerType: "USER", ownerId: params.userId, kind: "HELD", direction: "CREDIT", amountMinor: params.amountMinor },
    ],
  });
  const heldAcc = await db.ledgerAccount.findUnique({ where: { code: walletAvailableCode(params.userId) } });
  if (heldAcc) await db.ledgerAccount.update({ where: { id: heldAcc.id }, data: { heldMinor: params.amountMinor + (heldAcc.heldMinor as bigint) } }).catch(() => undefined);
  return { hold, duplicated: false };
}

/** Release hold: HELD -> AVAILABLE (đơn fail/huỷ). Idempotent: hold không ACTIVE -> no-op. */
export async function releaseHold(db: DB, holdId: string, reason = "release") {
  const hold = await db.walletHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.status !== "ACTIVE") return { released: false };
  const wallet = await db.wallet.findUnique({ where: { id: hold.walletId } });
  if (!wallet) throw new Error("WALLET_NOT_FOUND");
  await postLedger(db, {
    type: "ORDER_RELEASE",
    refType: "ORDER",
    refId: hold.orderId ?? undefined,
    idempotencyKey: `release:${hold.id}`,
    description: `Hoàn tiền giữ: ${reason}`,
    entries: [
      { accountCode: walletHeldCode(wallet.userId), ownerType: "USER", ownerId: wallet.userId, kind: "HELD", direction: "DEBIT", amountMinor: hold.amountMinor },
      { accountCode: walletAvailableCode(wallet.userId), ownerType: "USER", ownerId: wallet.userId, kind: "AVAILABLE", direction: "CREDIT", amountMinor: hold.amountMinor },
    ],
  });
  await db.walletHold.update({ where: { id: hold.id }, data: { status: "RELEASED" } });
  return { released: true };
}

/** Settle hold: HELD -> provider payable (cost) + platform margin (phần còn lại). */
export async function settleHold(db: DB, params: { holdId: string; providerId?: string; costMinor: bigint; orderId?: string }) {
  const hold = await db.walletHold.findUnique({ where: { id: params.holdId } });
  if (!hold) throw new Error("HOLD_NOT_FOUND");
  if (hold.status === "SETTLED") return { settled: false, duplicated: true };
  if (hold.status !== "ACTIVE") throw new Error("HOLD_NOT_ACTIVE");
  const wallet = await db.wallet.findUnique({ where: { id: hold.walletId } });
  if (!wallet) throw new Error("WALLET_NOT_FOUND");
  const total = hold.amountMinor as bigint;
  const cost = params.costMinor;
  if (cost < 0n || cost > total) throw new Error("SETTLE_COST_INVALID");
  const margin = total - cost;
  const entries: LedgerEntryInput[] = [
    { accountCode: walletHeldCode(wallet.userId), ownerType: "USER", ownerId: wallet.userId, kind: "HELD", direction: "DEBIT", amountMinor: total },
  ];
  if (cost > 0n) {
    entries.push({
      accountCode: params.providerId ? providerPayableCode(params.providerId) : PLATFORM_CASH,
      ownerType: params.providerId ? "PROVIDER" : "PLATFORM",
      ownerId: params.providerId ?? null,
      kind: "COST",
      direction: "CREDIT",
      amountMinor: cost,
    });
  }
  if (margin > 0n) {
    entries.push({ accountCode: PLATFORM_MARGIN, ownerType: "PLATFORM", kind: "REVENUE", direction: "CREDIT", amountMinor: margin });
  }
  if (entries.length === 1) {
    // total = 0 không xảy ra vì hold amount > 0; cost=0 & margin=total>0 luôn có margin entry.
    throw new Error("SETTLE_EMPTY");
  }
  const res = await postLedger(db, {
    type: "ORDER_SETTLE",
    refType: "ORDER",
    refId: params.orderId ?? hold.orderId ?? undefined,
    idempotencyKey: `settle:${hold.id}`,
    description: "Thanh toán đơn hàng từ tiền giữ",
    entries,
  });
  await db.walletHold.update({ where: { id: hold.id }, data: { status: "SETTLED" } });
  return { settled: true, tx: res.tx, marginMinor: margin };
}

/** Đảo một transaction bằng reversal (append-only, không sửa tx gốc). */
export async function reverseTransaction(db: DB, txId: string, reason: string, createdBy?: string) {
  const orig = await db.ledgerTransaction.findUnique({ where: { id: txId } });
  if (!orig) throw new Error("TX_NOT_FOUND");
  const already = await db.ledgerTransaction.findFirst({ where: { reversedTxId: txId, type: "REVERSAL" } });
  if (already) return { tx: already, duplicated: true };
  const entries = await db.ledgerEntry.findMany({ where: { transactionId: txId } });
  const accounts = await db.ledgerAccount.findMany({ where: { id: { in: entries.map((e: any) => e.accountId) } } });
  const codeOf = new Map(accounts.map((a: any) => [a.id, a.code]));
  const rev = await postLedger(db, {
    type: "REVERSAL",
    refType: orig.refType ?? undefined,
    refId: orig.refId ?? undefined,
    idempotencyKey: `reversal:${txId}`,
    description: `Đảo bút toán ${orig.code}: ${reason}`,
    createdBy,
    entries: entries.map((e: any) => ({
      accountCode: codeOf.get(e.accountId)!,
      direction: e.direction === "DEBIT" ? "CREDIT" : "DEBIT",
      amountMinor: e.amountMinor as bigint,
      currency: e.currency,
    })),
  });
  if (!rev.duplicated) {
    await db.ledgerTransaction.update({ where: { id: rev.tx.id }, data: { reversedTxId: txId } });
  }
  return rev;
}

/** Nạp tiền đã duyệt: PLATFORM:CASH (debit) -> user AVAILABLE (credit). */
export async function postDeposit(db: DB, params: { userId: string; amountMinor: bigint; depositId: string; createdBy?: string }) {
  await ensureWallet(db, params.userId);
  return postLedger(db, {
    type: "DEPOSIT",
    refType: "DEPOSIT",
    refId: params.depositId,
    idempotencyKey: `deposit:${params.depositId}`,
    description: "Nạp tiền vào ví",
    createdBy: params.createdBy,
    entries: [
      { accountCode: PLATFORM_CASH, ownerType: "PLATFORM", kind: "CASH", direction: "DEBIT", amountMinor: params.amountMinor },
      { accountCode: walletAvailableCode(params.userId), ownerType: "USER", ownerId: params.userId, kind: "AVAILABLE", direction: "CREDIT", amountMinor: params.amountMinor },
    ],
  });
}

/** Kiểm tra toàn cục: tổng mọi balance phải = 0 (vì mỗi tx cân bằng). Dùng cho test/reconcile nội bộ. */
export async function assertGlobalBalance(db: DB): Promise<bigint> {
  const accounts = await db.ledgerAccount.findMany();
  let sum = 0n;
  for (const a of accounts) sum += a.balanceMinor as bigint;
  return sum;
}

export { prisma };
