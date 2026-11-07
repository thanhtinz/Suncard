import { prisma } from "@/lib/prisma";
import { ok, fail, readJson, serialize } from "@/lib/api";
import { requireAuth, requirePermission, ApiError } from "@/modules/security";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// Đổi role/permission (spec bảng 8): duyệt kép, KHÔNG tự nâng quyền mình.
export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "roles.manage");
    const b = await readJson(req);
    if (b.userId === s.userId) throw new ApiError("PERMISSION_DENIED", 403, "Không được tự thay đổi quyền của chính mình");
    const role = await prisma.role.findUnique({ where: { code: b.roleCode } });
    const target = await prisma.user.findUnique({ where: { id: b.userId } });
    if (!role || !target) throw new ApiError("NOT_FOUND", 404);
    const approval = await prisma.financialApprovalRequest.create({
      data: { kind: "ROLE_CHANGE", makerId: s.userId, payload: { userId: b.userId, roleCode: b.roleCode, action: b.action ?? "GRANT", reason: b.reason } },
    });
    await prisma.financialApprovalRequest.update({ where: { id: approval.id }, data: { refId: approval.id } });
    await logAudit(prisma as unknown as DB, { actorId: s.userId, action: "ROLE_CHANGE_REQUESTED", entityType: "USER", entityId: b.userId, result: "PENDING", approvalId: approval.id, summary: `${b.action ?? "GRANT"} role ${b.roleCode} — chờ duyệt kép` });
    return ok(serialize({ approval }), 201);
  } catch (e) { return fail(e); }
}
