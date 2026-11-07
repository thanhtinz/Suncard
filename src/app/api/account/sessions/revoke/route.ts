import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/api";
import { requireAuth, ApiError } from "@/modules/security";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    const { sessionId, allOthers } = await readJson(req);
    if (allOthers) {
      await prisma.session.updateMany({ where: { userId: s.userId, revokedAt: null, id: { not: s.sid ?? "" } }, data: { revokedAt: new Date() } });
    } else {
      const target = await prisma.session.findUnique({ where: { id: sessionId } });
      if (!target || target.userId !== s.userId) throw new ApiError("NOT_FOUND", 404);
      await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    }
    await logAudit(prisma as unknown as DB, { actorId: s.userId, action: "SESSION_REVOKED", entityType: "SESSION", entityId: sessionId, result: "SUCCESS", summary: allOthers ? "Thu hồi mọi phiên khác" : "Thu hồi 1 phiên" });
    return ok({ revoked: true });
  } catch (e) { return fail(e); }
}
