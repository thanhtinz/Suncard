import { prisma } from "@/lib/prisma";
import { ok, fail, serialize } from "@/lib/api";
import { requireAuth } from "@/modules/security";
export async function GET(req: Request) {
  try {
    const s = await requireAuth();
    const url = new URL(req.url);
    const take = Math.min(100, Number(url.searchParams.get("limit") ?? 20));
    const orders = await prisma.order.findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" }, take });
    return ok(serialize({ orders }));
  } catch (e) { return fail(e); }
}
