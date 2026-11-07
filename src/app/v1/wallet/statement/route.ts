import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk, cursorOf, pageSize } from "@/lib/partner";
async function list(req: Request) {
  return withPartner(req, async ({ userId }) => {
    const url = new URL(req.url);
    const accounts = await prisma.ledgerAccount.findMany({ where: { ownerId: userId! } });
    const entries = await prisma.ledgerEntry.findMany({
      where: { accountId: { in: accounts.map((a) => a.id) } },
      take: pageSize(url) + 1, ...(cursorOf(url) ? { cursor: { id: cursorOf(url)! }, skip: 1 } : {}), orderBy: { createdAt: "desc" },
    });
    const txIds = [...new Set(entries.map((e) => e.transactionId))];
    const txs = await prisma.ledgerTransaction.findMany({ where: { id: { in: txIds } } });
    const hasMore = entries.length > pageSize(url);
    const page = hasMore ? entries.slice(0, -1) : entries;
    return partnerOk({ transactions: page.map((e) => ({ id: e.id, transaction: txs.find((t) => t.id === e.transactionId)?.code, type: txs.find((t) => t.id === e.transactionId)?.type, direction: e.direction, amount_minor: e.amountMinor.toString(), balance_after_minor: e.balanceAfterMinor.toString(), currency: e.currency, created_at: e.createdAt })), next_cursor: hasMore ? page[page.length - 1].id : null });
  });
}
export const GET = list;
