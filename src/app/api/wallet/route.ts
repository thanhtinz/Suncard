import { prisma } from "@/lib/prisma";
import { ok, fail, serialize } from "@/lib/api";
import { requireAuth } from "@/modules/security";
import { getWalletBalances, type DB } from "@/modules/ledger";
export async function GET() {
  try {
    const s = await requireAuth();
    const balances = await getWalletBalances(prisma as unknown as DB, s.userId);
    const accounts = await prisma.ledgerAccount.findMany({ where: { ownerId: s.userId } });
    const entries = accounts.length ? await prisma.ledgerEntry.findMany({ where: { accountId: { in: accounts.map((a) => a.id) } }, orderBy: { createdAt: "desc" }, take: 50 }) : [];
    const credit = await prisma.creditAccount.findUnique({ where: { userId: s.userId } });
    return ok(serialize({ balances, entries, credit }));
  } catch (e) { return fail(e); }
}
