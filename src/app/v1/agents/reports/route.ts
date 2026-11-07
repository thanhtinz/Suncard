import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
import { ApiError } from "@/modules/security";
import { branchAgentIds } from "@/modules/agents";
import type { DB } from "@/modules/ledger";
export async function GET(req: Request) {
  return withPartner(req, async ({ userId }) => {
    const agent = await prisma.agent.findUnique({ where: { userId: userId! } });
    if (!agent) throw new ApiError("PERMISSION_DENIED", 403);
    const ids = await branchAgentIds(prisma as unknown as DB, agent.id);
    const orders = await prisma.order.findMany({ where: { agentId: { in: ids }, status: "SUCCESS" } });
    const byAgent = new Map<string, { orders: number; revenue: bigint }>();
    for (const o of orders) {
      const cur = byAgent.get(o.agentId ?? "") ?? { orders: 0, revenue: 0n };
      cur.orders++; cur.revenue += o.totalMinor as bigint;
      byAgent.set(o.agentId ?? "", cur);
    }
    const commissions = await prisma.commissionEntry.aggregate({ where: { beneficiaryUserId: userId! }, _sum: { amountMinor: true } });
    return partnerOk({ branch: [...byAgent.entries()].map(([agentId, v]) => ({ agent_id: agentId, orders: v.orders, revenue_minor: v.revenue.toString() })), total_commission_minor: (commissions._sum.amountMinor ?? 0n).toString() });
  });
}
