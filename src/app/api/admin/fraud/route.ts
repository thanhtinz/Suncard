import { prisma } from "@/lib/prisma";
import { ok, fail, serialize } from "@/lib/api";
import { requireAuth, requirePermission } from "@/modules/security";
// Fraud queue (spec mục 9): các RiskReview đang chờ + đã duyệt, kèm điểm và tín hiệu từng đơn.
export async function GET(req: Request) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "disputes.manage");
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "PENDING";
    const reviews = await prisma.riskReview.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 100 });
    return ok(serialize({ reviews }));
  } catch (e) { return fail(e); }
}
