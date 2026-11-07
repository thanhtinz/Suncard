import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
import { resolvePrice } from "@/modules/pricing";
import { agentOfUser } from "@/modules/agents";
import type { DB } from "@/modules/ledger";
export async function GET(req: Request) {
  return withPartner(req, async ({ userId }) => {
    const url = new URL(req.url);
    const variantId = url.searchParams.get("variant_id");
    const variants = variantId
      ? await prisma.productVariant.findMany({ where: { id: variantId } })
      : await prisma.productVariant.findMany({ where: { isActive: true }, take: 200 });
    const agent = userId ? await agentOfUser(prisma as unknown as DB, userId) : null;
    const prices = [];
    for (const v of variants) {
      const r = await resolvePrice(prisma as unknown as DB, { userId: userId!, agentId: agent?.id, agentLevelId: agent?.levelId, variantId: v.id });
      prices.push({ variant_id: v.id, sku: v.sku, face_value_minor: v.faceValueMinor.toString(), price_minor: r.unitPriceMinor.toString(), currency: v.currency, source: r.source });
    }
    return partnerOk({ prices });
  });
}
