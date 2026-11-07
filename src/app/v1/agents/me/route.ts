import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
import { ApiError } from "@/modules/security";
export async function GET(req: Request) {
  return withPartner(req, async ({ userId }) => {
    const agent = await prisma.agent.findUnique({ where: { userId: userId! } });
    if (!agent) throw new ApiError("PERMISSION_DENIED", 403, "Tài khoản không phải đại lý");
    const level = await prisma.agentLevel.findUnique({ where: { id: agent.levelId } });
    const credit = await prisma.creditAccount.findUnique({ where: { userId: userId! } });
    return partnerOk({ agent, level, credit: credit ? { limit_minor: credit.limitMinor.toString(), outstanding_minor: credit.outstandingMinor.toString() } : null });
  });
}
