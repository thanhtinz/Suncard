import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, ApiError, hashPassword } from "@/modules/security";
import { createAgent } from "@/modules/agents";
import { ensureWallet, type DB } from "@/modules/ledger";
import { ensureCreditAccount } from "@/modules/credit";

// Tạo sub-agent trực tiếp: tạo user + agent dưới nhánh của tôi (closure + audit qua agent_relation_history).
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const myAgent = await prisma.agent.findUnique({ where: { userId: s.userId } });
    if (!myAgent) throw new ApiError("PERMISSION_DENIED", 403, "Chỉ đại lý mới tạo được đại lý con");
    const b = await readJson(req);
    const existing = await prisma.user.findUnique({ where: { email: b.email } });
    if (existing) throw new Error("DUPLICATE_REQUEST");
    const level = b.levelId ? await prisma.agentLevel.findUnique({ where: { id: b.levelId } }) : await prisma.agentLevel.findFirst({ orderBy: { rank: "asc" } });
    if (!level) throw new Error("VALIDATION_LEVEL");
    const agentRole = await prisma.role.findUnique({ where: { code: "AGENT" } });
    const result = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email: b.email, passwordHash: await hashPassword(b.password ?? "Suncard@123"), kycStatus: "NONE" } });
      await tx.userProfile.create({ data: { userId: u.id, fullName: b.fullName ?? b.email } });
      if (agentRole) await tx.userRole.create({ data: { userId: u.id, roleId: agentRole.id } });
      await ensureWallet(tx as DB, u.id);
      const ag = await createAgent(tx as DB, { userId: u.id, levelId: level.id, parentId: myAgent.id, code: `AG${Date.now().toString(36).toUpperCase()}`, actorId: s.userId });
      await ensureCreditAccount(tx as DB, u.id, ag.id);
      return { user: u, agent: ag };
    });
    return ok(serialize(result), 201);
  } catch (e) { return fail(e); }
}
