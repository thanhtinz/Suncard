import { withPartner, partnerOk } from "@/lib/partner";
import { getWalletBalances, type DB } from "@/modules/ledger";
import { prisma } from "@/lib/prisma";
export async function GET(req: Request) {
  return withPartner(req, async ({ userId }) => {
    const b = await getWalletBalances(prisma as unknown as DB, userId!);
    const credit = await prisma.creditAccount.findUnique({ where: { userId: userId! } });
    return partnerOk({ available_minor: b.available.toString(), held_minor: b.held.toString(), commission_minor: b.commission.toString(), currency: "VND", credit: credit ? { limit_minor: credit.limitMinor.toString(), outstanding_minor: credit.outstandingMinor.toString(), available_minor: (credit.limitMinor - credit.outstandingMinor - credit.reservedMinor).toString() } : null });
  });
}
