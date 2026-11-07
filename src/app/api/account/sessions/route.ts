import { prisma } from "@/lib/prisma";
import { ok, fail, serialize } from "@/lib/api";
import { requireAuth } from "@/modules/security";
// ACC-07: xem các phiên hoạt động của chính mình.
export async function GET() {
  try {
    const s = await requireAuth();
    const sessions = await prisma.session.findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" }, take: 50 });
    return ok(serialize({ sessions: sessions.map((x) => ({ id: x.id, ip: x.ip, userAgent: x.userAgent, createdAt: x.createdAt, expiresAt: x.expiresAt, revokedAt: x.revokedAt, current: x.id === s.sid, active: !x.revokedAt && x.expiresAt > new Date() })) }));
  } catch (e) { return fail(e); }
}
