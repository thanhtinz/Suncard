import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk, pageSize, cursorOf } from "@/lib/partner";
export async function GET(req: Request) {
  return withPartner(req, async ({ userId }) => {
    const url = new URL(req.url);
    const entries = await prisma.commissionEntry.findMany({ where: { beneficiaryUserId: userId! }, take: pageSize(url) + 1, ...(cursorOf(url) ? { cursor: { id: cursorOf(url)! }, skip: 1 } : {}), orderBy: { createdAt: "desc" } });
    const hasMore = entries.length > pageSize(url);
    const page = hasMore ? entries.slice(0, -1) : entries;
    return partnerOk({ commissions: page.map((e) => ({ ...e, amountMinor: e.amountMinor.toString(), baseMinor: e.baseMinor.toString() })), next_cursor: hasMore ? page[page.length - 1].id : null });
  });
}
