import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/api";
import { requireAuth, requirePermission, ApiError } from "@/modules/security";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// Bảo trì hệ thống từ Admin → Cache & dọn dữ liệu:
// - action "revalidate": xoá cache render của toàn site (revalidatePath layout).
// - action "prune": xoá Notification ĐÃ ĐỌC và AuditLog cũ hơn số ngày cho phép
//   (chỉ đúng 2 bảng này). Mọi lần chạy đều ghi AuditLog SYSTEM_MAINTENANCE.
const PRUNE_DAYS = [90, 180, 365];

export async function POST(req: Request) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "settings.update");
    const b = await readJson(req);
    const db = prisma as unknown as DB;

    if (b.action === "revalidate") {
      revalidatePath("/", "layout");
      await logAudit(db, { actorId: s.userId, action: "SYSTEM_MAINTENANCE", entityType: "SYSTEM", entityId: "cache", result: "SUCCESS", summary: "Xoá cache trang (revalidate toàn site)" });
      return ok({ action: "revalidate", revalidated: true });
    }

    if (b.action === "prune") {
      const days = Number(b.days);
      if (!PRUNE_DAYS.includes(days)) throw new ApiError("VALIDATION_ERROR", 422, "Số ngày dọn dữ liệu chỉ nhận 90, 180 hoặc 365");
      const cutoff = new Date(Date.now() - days * 86400 * 1000);
      const notifications = await prisma.notification.deleteMany({ where: { readAt: { not: null }, createdAt: { lt: cutoff } } });
      const auditLogs = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
      await logAudit(db, {
        actorId: s.userId, action: "SYSTEM_MAINTENANCE", entityType: "SYSTEM", entityId: "prune", result: "SUCCESS",
        summary: `Dọn dữ liệu cũ hơn ${days} ngày: xoá ${notifications.count} thông báo đã đọc, ${auditLogs.count} dòng nhật ký kiểm toán`,
      });
      return ok({ action: "prune", days, deletedNotifications: notifications.count, deletedAuditLogs: auditLogs.count });
    }

    throw new ApiError("VALIDATION_ERROR", 422, "action không hợp lệ");
  } catch (e) { return fail(e); }
}
