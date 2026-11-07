import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
import { ApiError } from "@/modules/security";
export async function GET(req: Request) {
  return withPartner(req, async ({ userId }) => {
    const agent = await prisma.agent.findUnique({ where: { userId: userId! } });
    if (!agent) throw new ApiError("PERMISSION_DENIED", 403);
    const plans = await prisma.pricingPlan.findMany({ where: { OR: [{ scopeType: "AGENT_LEVEL", scopeId: agent.levelId }, { scopeType: "DEFAULT" }], isActive: true } });
    const rules = await prisma.priceRule.findMany({ where: { planId: { in: plans.map((p) => p.id) } } });
    return partnerOk({ plans, rules: rules.map((r) => ({ ...r, fixedPriceMinor: r.fixedPriceMinor?.toString() })) });
  });
}
