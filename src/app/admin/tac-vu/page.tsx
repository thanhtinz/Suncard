import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge, Empty } from "@/components/ui";
import { getNumberSetting } from "@/modules/settings";

export const dynamic = "force-dynamic";

// Trang chỉ hiển thị trạng thái các tác vụ nền chạy qua /api/cron/ops
// (bảo vệ bằng CRON_SECRET qua header, fail-closed). Không có nút chạy tay.
export default async function AdminCronPage() {
  const [unknownAfterMin, pendingAfterMin, lookbackH, alertThreshold, opsNotifs, providers] = await Promise.all([
    getNumberSetting("orders.unknown_inquiry_after_minutes", 5),
    getNumberSetting("ops.pending_inquiry_after_minutes", 30),
    getNumberSetting("ops.reconcile_lookback_hours", 24),
    getNumberSetting("ops.unknown_alert_threshold", 10),
    prisma.notification.findMany({ where: { type: { startsWith: "OPS_" } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.provider.findMany({ where: { status: "ACTIVE" }, orderBy: { priority: "asc" } }),
  ]);

  // Thông báo vận hành được gửi cho từng quản trị viên — gộp theo loại + tiêu đề.
  type AlertRow = { type: string; title: string; body: string | null; at: Date; recipients: number; unread: number };
  const alertMap = new Map<string, AlertRow>();
  for (const n of opsNotifs) {
    const k = `${n.type}|${n.title}`;
    const row = alertMap.get(k) ?? { type: n.type, title: n.title, body: n.body, at: n.createdAt, recipients: 0, unread: 0 };
    row.recipients += 1;
    if (!n.readAt) row.unread += 1;
    if (n.createdAt > row.at) row.at = n.createdAt;
    alertMap.set(k, row);
  }
  const alerts = Array.from(alertMap.values()).sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 20);

  const health = await Promise.all(providers.map(async (p) => {
    const latest = await prisma.providerHealthMetric.findFirst({ where: { providerId: p.id }, orderBy: { createdAt: "desc" } });
    return { provider: p, metric: latest };
  }));

  const jobs = [
    {
      name: "Hỏi lại đơn tồn đọng (inquiry)",
      desc: `Tự hỏi lại trạng thái các đơn UNKNOWN quá ${unknownAfterMin} phút (mọi nhà cung cấp) và đơn PENDING của nhà cung cấp HTTP quá ${pendingAfterMin} phút, tối đa 50 đơn mỗi vòng.`,
      icon: "fa-solid fa-magnifying-glass",
    },
    {
      name: "Đối soát nhà cung cấp HTTP",
      desc: `Chạy đối soát giao dịch với nhà cung cấp HTTP_CHARGING trong cửa sổ ${lookbackH} giờ gần nhất và ghi nhận các mục lệch.`,
      icon: "fa-solid fa-scale-balanced",
    },
    {
      name: "Cảnh báo vận hành",
      desc: `Gửi thông báo cho quản trị viên khi số đơn UNKNOWN vượt ngưỡng ${alertThreshold} hoặc khi circuit breaker của một nhà cung cấp đang MỞ.`,
      icon: "fa-solid fa-bell",
    },
    {
      name: "Dọn bộ đếm giới hạn tần suất",
      desc: "Xoá các bộ đếm rate-limit đã hết hạn để bảng dữ liệu không phình to theo thời gian.",
      icon: "fa-solid fa-broom",
    },
  ];

  return (
    <div className="space-y-8">
      <PageTitle title="Tác vụ tự động" sub="Các việc nền chạy theo lịch qua /api/cron/ops (xác thực bằng CRON_SECRET, từ chối khi chưa cấu hình)" />
      <section>
        <h2 className="font-bold text-navy mb-3">Danh sách tác vụ định kỳ</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {jobs.map((j) => (
            <div key={j.name} className="card p-4">
              <div className="font-semibold text-navy"><i className={`${j.icon} mr-2`} aria-hidden="true" />{j.name}</div>
              <p className="text-sm text-slate-500 mt-1">{j.desc}</p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-bold text-navy mb-3">Cảnh báo vận hành gần nhất</h2>
        {alerts.length === 0 ? <Empty text="Chưa có cảnh báo vận hành nào" /> : (
          <DataTable cols={["Loại", "Tiêu đề", "Nội dung", "Số người nhận", "Chưa đọc", "Gần nhất lúc"]} rows={alerts.map((a) => [
            a.type, a.title, a.body ?? "—", String(a.recipients), String(a.unread), a.at.toISOString().slice(0, 19).replace("T", " "),
          ])} />
        )}
      </section>
      <section>
        <h2 className="font-bold text-navy mb-3">Trạng thái circuit breaker theo nhà cung cấp</h2>
        {health.length === 0 ? <Empty text="Chưa có nhà cung cấp đang hoạt động" /> : (
          <DataTable cols={["Nhà cung cấp", "Circuit", "Lỗi liên tiếp", "Đúng / Lỗi / Chưa rõ (cửa sổ gần nhất)", "Độ trễ TB (ms)", "Cập nhật"]} rows={health.map(({ provider, metric }) => [
            `${provider.code} — ${provider.name}`,
            metric ? <StatusBadge key="c" status={metric.circuitState} /> : "Chưa có dữ liệu",
            metric ? String(metric.consecutiveFails) : "—",
            metric ? `${metric.success} / ${metric.failed} / ${metric.unknown}` : "—",
            metric ? String(metric.avgLatencyMs) : "—",
            metric ? metric.createdAt.toISOString().slice(0, 19).replace("T", " ") : "—",
          ])} />
        )}
      </section>
    </div>
  );
}
