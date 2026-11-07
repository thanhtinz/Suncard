import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, ApiError } from "@/modules/security";
import { randomToken } from "@/lib/crypto";
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const myAgent = await prisma.agent.findUnique({ where: { userId: s.userId } });
    if (!myAgent) throw new ApiError("PERMISSION_DENIED", 403, "Chỉ đại lý mới mời được đại lý con");
    const b = await readJson(req);
    const inv = await prisma.agentInvitation.create({
      data: { inviterAgentId: myAgent.id, email: b.email, levelId: b.levelId, token: randomToken(16), expiresAt: new Date(Date.now() + 7 * 86400000) },
    });
    return ok(serialize({ invitation: inv }), 201);
  } catch (e) { return fail(e); }
}
