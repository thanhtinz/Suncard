import { prisma } from "../src/lib/prisma";
import { ensureWallet, postDeposit, type DB } from "../src/modules/ledger";
import { hashPassword } from "../src/modules/password";

let seq = 0;
export function uniq(prefix: string) {
  seq++;
  return `${prefix}${Date.now().toString(36)}${seq}`;
}

export async function makeFundedUser(amount = 10_000_000n) {
  const email = `${uniq("test")}@suncard.vn`;
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword("Suncard@123"), kycStatus: "VERIFIED" },
  });
  await prisma.userProfile.create({ data: { userId: user.id, fullName: "Test User" } });
  await prisma.$transaction(async (tx) => {
    await ensureWallet(tx as DB, user.id);
    if (amount > 0n) {
      const dep = await tx.deposit.create({
        data: { userId: user.id, method: "BANK_TRANSFER", amountMinor: amount, status: "APPROVED", makerId: "test", checkerId: "test", idempotencyKey: `test-dep:${user.id}` },
      });
      await postDeposit(tx as DB, { userId: user.id, amountMinor: amount, depositId: dep.id });
    }
  });
  return user;
}

export function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}
export function assertEq(a: unknown, b: unknown, msg: string) {
  if (String(a) !== String(b)) throw new Error(`ASSERT FAILED: ${msg} — got ${String(a)}, want ${String(b)}`);
}
export async function assertThrows(fn: () => Promise<unknown>, codePart: string, msg: string) {
  try {
    await fn();
  } catch (e: any) {
    if (String(e?.message ?? e).includes(codePart) || String(e?.code ?? "").includes(codePart)) return;
    throw new Error(`ASSERT FAILED: ${msg} — threw ${e?.message}, want containing ${codePart}`);
  }
  throw new Error(`ASSERT FAILED: ${msg} — did not throw`);
}

export { prisma };
