import { prisma } from "@/lib/prisma";
import { sha256Hex, timingSafeEqualHex } from "@/lib/crypto";
import { getNumberSetting } from "./settings";
import { inquireOrder } from "./orders-service";
import { runReconciliation } from "./reconciliation";
import { notifyUser } from "./audit";
import { purgeOldRateCounters } from "./rate-limit";
import { ADMIN_ROLES } from "./security";
import type { DB } from "./ledger";

// ============================================================================
// Worker nền qua cron (Phase 2/4):
// - Xác thực cron bằng secret so timing-safe qua HEADER, fail-closed
//   (chưa cấu hình CRON_SECRET -> từ chối; KHÔNG nhận secret qua query string).
// - Việc: (a) inquiry đơn UNKNOWN/PENDING tồn đọng, (b) đối soát provider HTTP
//   theo lịch, (c) cảnh báo vận hành (UNKNOWN tồn đọng / circuit breaker mở)
//   qua Notification cho toàn bộ tài khoản quản trị + hiện ở Admin dashboard.
// ============================================================================

export function cronSecretMatches(provided: string | null | undefined): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !provided) return false;
  return timingSafeEqualHex(sha256Hex(provided), sha256Hex(expected));
}

export function cronAuthorized(req: Request): boolean {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  return cronSecretMatches(req.headers.get("x-cron-secret") ?? bearer);
}

export async function notifyAdmins(
  db: DB,
  params: { type: string; title: string; body?: string; resourceType?: string; resourceId?: string }
): Promise<number> {
  const roles = await db.role.findMany({ where: { code: { in: ADMIN_ROLES } } });
  if (roles.length === 0) return 0;
  const urs = await db.userRole.findMany({ where: { roleId: { in: roles.map((r: { id: string }) => r.id) } } });
  const userIds: string[] = [...new Set<string>(urs.map((r: { userId: string }) => String(r.userId)))];
  let sent = 0;
  for (const userId of userIds) {
    // Chống spam: đã có thông báo cùng loại + cùng resource chưa đọc trong 24h thì bỏ qua.
    const existing = await db.notification.findFirst({
      where: { userId, type: params.type, resourceId: params.resourceId ?? undefined, readAt: null, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    });
    if (existing) continue;
    await notifyUser(db, { userId, type: params.type, title: params.title, body: params.body, resourceType: params.resourceType, resourceId: params.resourceId });
    sent++;
  }
  return sent;
}

export async function runOpsCron() {
  const db = prisma as unknown as DB;
  const summary: {
    inquired: number; stillUnknown: number;
    reconciled: { provider: string; total: number; matched: number; mismatched: number }[];
    alertsSent: number; rateCountersPurged: number;
  } = { inquired: 0, stillUnknown: 0, reconciled: [], alertsSent: 0, rateCountersPurged: 0 };

  // (a) Inquiry đơn tồn đọng: UNKNOWN quá hạn (mọi provider) + PENDING của provider HTTP quá hạn.
  const unknownAfterMin = await getNumberSetting("orders.unknown_inquiry_after_minutes", 5);
  const pendingAfterMin = await getNumberSetting("ops.pending_inquiry_after_minutes", 30);
  const httpProviders = await prisma.provider.findMany({ where: { code: "HTTP_CHARGING", status: "ACTIVE" } });
  const staleUnknown = await prisma.order.findMany({
    where: { status: "UNKNOWN", updatedAt: { lt: new Date(Date.now() - unknownAfterMin * 60000) } },
    take: 50, orderBy: { updatedAt: "asc" },
  });
  const stalePending = httpProviders.length > 0
    ? await prisma.order.findMany({
        where: { status: "PENDING", providerId: { in: httpProviders.map((p) => p.id) }, updatedAt: { lt: new Date(Date.now() - pendingAfterMin * 60000) } },
        take: 50, orderBy: { updatedAt: "asc" },
      })
    : [];
  const seen = new Set<string>();
  for (const o of [...staleUnknown, ...stalePending]) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    try {
      const r = await inquireOrder(o.id, "cron");
      summary.inquired++;
      if (r.order?.status === "UNKNOWN") summary.stillUnknown++;
    } catch { /* đơn lỗi riêng lẻ không chặn cả vòng cron */ }
  }

  // (b) Đối soát theo lịch cho provider HTTP_CHARGING.
  const lookbackH = await getNumberSetting("ops.reconcile_lookback_hours", 24);
  for (const p of httpProviders) {
    try {
      const run = await runReconciliation(db, {
        providerId: p.id,
        from: new Date(Date.now() - lookbackH * 3600 * 1000),
        to: new Date(),
        createdBy: "cron",
      });
      summary.reconciled.push({ provider: p.code, total: run.totalItems, matched: run.matched, mismatched: run.mismatched });
    } catch { /* provider lỗi không chặn cảnh báo phía dưới */ }
  }

  // (c) Cảnh báo vận hành.
  const threshold = await getNumberSetting("ops.unknown_alert_threshold", 10);
  const unknownCount = await prisma.order.count({ where: { status: "UNKNOWN" } });
  if (unknownCount > threshold) {
    summary.alertsSent += await notifyAdmins(db, {
      type: "OPS_UNKNOWN_BACKLOG",
      title: `Cảnh báo vận hành: ${unknownCount} đơn đang ở trạng thái Đang xác minh (UNKNOWN)`,
      body: `Số đơn UNKNOWN vượt ngưỡng cấu hình (${threshold}). Kiểm tra trạng thái provider và chạy inquiry.`,
      resourceType: "ORDER", resourceId: "UNKNOWN_BACKLOG",
    });
  }
  const activeProviders = await prisma.provider.findMany({ where: { status: "ACTIVE" } });
  for (const p of activeProviders) {
    const latest = await prisma.providerHealthMetric.findFirst({ where: { providerId: p.id }, orderBy: { createdAt: "desc" } });
    if (latest?.circuitState === "OPEN") {
      summary.alertsSent += await notifyAdmins(db, {
        type: "OPS_CIRCUIT_OPEN",
        title: `Circuit breaker đang MỞ: provider ${p.code}`,
        body: `Provider ${p.name} tạm ngắt do lỗi liên tiếp. Routing đang bỏ qua provider này.`,
        resourceType: "PROVIDER", resourceId: p.id,
      });
    }
  }

  summary.rateCountersPurged = await purgeOldRateCounters().catch(() => 0);
  return summary;
}
