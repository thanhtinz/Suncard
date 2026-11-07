import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
import { ApiError, hashPassword } from "@/modules/security";
import { createAgent } from "@/modules/agents";
import { ensureWallet, type DB } from "@/modules/ledger";
export async function POST(req: Request) {
  return withPartner(req, async ({ userId, body }) => {
    const myAgent = await prisma.agent.findUnique({ where: { userId: userId! } });
    if (!myAgent) throw new ApiError("PERMISSION_DENIED", 403);
    const level = body.level_id ? await prisma.agentLevel.findUnique({ where: { id: body.level_id } }) : await prisma.agentLevel.findFirst({ orderBy: { rank: "asc" } });
    if (!level) throw new ApiError("VALIDATION_ERROR", 422);
    const result = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email: body.email, passwordHash: await hashPassword(body.password ?? "Suncard@123") } });
      await tx.userProfile.create({ data: { userId: u.id, fullName: body.full_name ?? body.email } });
      await ensureWallet(tx as DB, u.id);
      const ag = await createAgent(tx as DB, { userId: u.id, levelId: level.id, parentId: myAgent.id, code: `AG${Date.now().toString(36).toUpperCase()}`, actorId: userId! });
      return { user_id: u.id, agent_id: ag.id };
    });
    return partnerOk(result, 201);
  });
}
