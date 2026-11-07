import { prisma } from "@/lib/prisma";
import { getNumberSetting } from "./settings";
import { logAudit } from "./audit";
import type { DB } from "./ledger";

// Risk Engine (Security Spec mục 9): chấm điểm 0–100 từ nhóm tín hiệu
// account/device/network/payment/order/delivery/refund.
// Mức: Low tự động | Medium step-up + giới hạn | High giữ giao mã + manual review (risk_reviews)
//      | Critical chặn + thu hồi phiên/token + incident.
// KHÔNG chặn cứng chỉ vì VPN/IP dùng chung — tín hiệu shared IP trọng số rất nhỏ.

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export interface RiskSignal { key: string; points: number; detail: string }
export interface RiskResult { score: number; level: RiskLevel; signals: RiskSignal[]; reviewId?: string }

export async function levelOf(score: number): Promise<RiskLevel> {
  const [med, high, crit] = await Promise.all([
    getNumberSetting("risk.threshold_medium", 30),
    getNumberSetting("risk.threshold_high", 60),
    getNumberSetting("risk.threshold_critical", 80),
  ]);
  if (score >= crit) return "CRITICAL";
  if (score >= high) return "HIGH";
  if (score >= med) return "MEDIUM";
  return "LOW";
}

export function scoreFromSignals(signals: RiskSignal[]): number {
  return Math.min(100, signals.reduce((s, x) => s + x.points, 0));
}

export async function collectSignals(
  db: DB,
  params: { userId: string; amountMinor?: bigint; ip?: string; deviceId?: string }
): Promise<RiskSignal[]> {
  const signals: RiskSignal[] = [];
  const w = async (k: string, d: number) => getNumberSetting(k, d);
  const user = await db.user.findUnique({ where: { id: params.userId } });
  if (!user) return signals;
  const now = Date.now();
  if (now - user.createdAt.getTime() < 86400000) {
    signals.push({ key: "new_account", points: await w("risk.w_new_account", 15), detail: "Tài khoản < 1 ngày" });
  }
  if ((user.failedLogins ?? 0) >= 3) {
    signals.push({ key: "failed_logins", points: await w("risk.w_failed_logins", 10), detail: `Đăng nhập sai ${user.failedLogins} lần` });
  }
  if (params.deviceId) {
    const known = await db.userDevice.findFirst({ where: { userId: params.userId, deviceId: params.deviceId } });
    if (!known) signals.push({ key: "new_device", points: await w("risk.w_new_device", 15), detail: "Thiết bị mới" });
  }
  const hourAgo = new Date(now - 3600000);
  const orders1h = await db.order.count({ where: { userId: params.userId, createdAt: { gte: hourAgo } } });
  if (orders1h >= 5) {
    signals.push({ key: "velocity_orders", points: await w("risk.w_velocity_orders", 20), detail: `${orders1h} đơn trong 1 giờ` });
  }
  if (params.amountMinor && params.amountMinor >= 5_000_000n) {
    signals.push({ key: "large_amount", points: await w("risk.w_large_amount", 15), detail: "Giá trị giao dịch lớn" });
  }
  const reveals1h = await db.cardAccessAudit.count({ where: { userId: params.userId, action: "REVEAL", createdAt: { gte: hourAgo } } });
  if (reveals1h >= 10) {
    signals.push({ key: "reveal_velocity", points: await w("risk.w_reveal_velocity", 20), detail: `${reveals1h} lần reveal trong 1 giờ` });
  }
  const disputes = await db.dispute.count({ where: { userId: params.userId, createdAt: { gte: new Date(now - 30 * 86400000) } } });
  if (disputes > 0) {
    signals.push({ key: "refund_history", points: await w("risk.w_refund_history", 15), detail: `${disputes} tranh chấp trong 30 ngày` });
  }
  if (params.ip) {
    const others = await db.session.count({ where: { ip: params.ip, userId: { not: params.userId } } });
    if (others >= 3) {
      signals.push({ key: "shared_ip", points: await w("risk.w_shared_ip", 5), detail: "IP dùng chung nhiều tài khoản (chỉ cộng điểm nhỏ)" });
    }
  }
  return signals;
}

/**
 * Đánh giá rủi ro cho một hành động nhạy cảm.
 * HIGH -> tạo RiskReview PENDING (fraud queue). CRITICAL -> chặn + thu hồi mọi phiên của user + audit incident.
 */
export async function evaluateRisk(
  db: DB,
  params: { userId: string; action: string; orderId?: string; amountMinor?: bigint; ip?: string; deviceId?: string }
): Promise<RiskResult> {
  const signals = await collectSignals(db, params);
  const score = scoreFromSignals(signals);
  const level = await levelOf(score);
  const result: RiskResult = { score, level, signals };
  if (level === "HIGH" || level === "CRITICAL") {
    const review = await db.riskReview.create({
      data: { userId: params.userId, orderId: params.orderId, action: params.action, score, level, signals: signals as never, status: "PENDING" },
    });
    result.reviewId = review.id;
    await logAudit(db, {
      actorId: params.userId, actorType: "USER", action: "RISK_HELD", entityType: "ORDER", entityId: params.orderId,
      result: "PENDING", ip: params.ip, deviceId: params.deviceId,
      summary: `Risk ${level} score=${score}: ${signals.map((s) => s.key).join(",")}`,
    });
    if (level === "CRITICAL") {
      await db.session.updateMany({ where: { userId: params.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await logAudit(db, {
        actorType: "SYSTEM", action: "INCIDENT_CRITICAL_RISK", entityType: "USER", entityId: params.userId,
        result: "DENIED", summary: `Critical risk score=${score} — đã thu hồi toàn bộ phiên, chờ điều tra`,
      });
    }
  }
  return result;
}

/** Đơn/hành động bị giữ ở mức HIGH được tiếp tục khi có RiskReview APPROVED trong 24h. */
export async function hasApprovedReview(db: DB, userId: string, orderId?: string): Promise<boolean> {
  const since = new Date(Date.now() - 86400000);
  const r = await db.riskReview.findFirst({
    where: { userId, status: "APPROVED", createdAt: { gte: since }, ...(orderId ? { orderId } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return !!r;
}
export { prisma };
