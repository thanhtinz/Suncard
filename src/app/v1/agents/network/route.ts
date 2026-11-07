import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
import { ApiError } from "@/modules/security";
import { type DB } from "@/modules/ledger";
import { branchAgentIds as branchIds } from "@/modules/agents";
export async function GET(req: Request) {
  return withPartner(req, async ({ userId }) => {
    const agent = await prisma.agent.findUnique({ where: { userId: userId! } });
    if (!agent) throw new ApiError("PERMISSION_DENIED", 403);
    const ids = await branchIds(prisma as unknown as DB, agent.id);
    const agents = await prisma.agent.findMany({ where: { id: { in: ids } } });
    const closure = await prisma.agentClosure.findMany({ where: { ancestorId: agent.id } });
    return partnerOk({ network: agents.map((a) => ({ ...a, depth: closure.find((c) => c.descendantId === a.id)?.depth })) });
  });
}
