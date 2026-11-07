import { prisma } from "@/lib/prisma";
import { PageTitle, Money } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [revenue, margin, unknownCount, reconOpen, users, ordersToday, ordersTotal] = await Promise.all([
    prisma.order.aggregate({ where: { status: "SUCCESS" }, _sum: { totalMinor: true } }),
    prisma.ledgerAccount.findUnique({ where: { code: "PLATFORM:MARGIN" } }),
    prisma.order.count({ where: { status: "UNKNOWN" } }),
    prisma.reconciliationCase.count({ where: { status: "OPEN" } }),
    prisma.user.count(),
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.order.count(),
  ]);
  // Cảnh báo vận hành do cron ops sinh (UNKNOWN tồn đọng, circuit breaker mở) — 7 ngày gần nhất.
  const opsAlerts = await prisma.notification.findMany({
    where: { type: { in: ["OPS_UNKNOWN_BACKLOG", "OPS_CIRCUIT_OPEN"] }, createdAt: { gte: new Date(Date.now() - 7 * 86400 * 1000) } },
    orderBy: { createdAt: "desc" }, take: 5,
  });
  const seenAlert = new Set<string>();
  const uniqAlerts = opsAlerts.filter((n) => {
    const k = `${n.type}:${n.resourceId ?? ""}`;
    if (seenAlert.has(k)) return false;
    seenAlert.add(k);
    return true;
  });
  const cards: [string, React.ReactNode, string?][] = [
    ["Tổng doanh thu (đơn thành công)", <Money key="r" v={revenue._sum.totalMinor ?? BigInt(0)} />],
    ["Biên nền tảng (PLATFORM:MARGIN)", <Money key="m" v={margin?.balanceMinor ?? BigInt(0)} />],
    ["Đơn đang xác minh (UNKNOWN)", String(unknownCount), "/admin/don-nap"],
    ["Ca đối soát đang mở", String(reconOpen), "/admin/doi-soat"],
    ["Tổng người dùng", String(users), "/admin/nguoi-dung"],
    ["Đơn hôm nay", String(ordersToday)],
    ["Tổng số đơn", String(ordersTotal)],
  ];
  return (
    <div>
      <PageTitle title="Tổng quan quản trị" sub="Chỉ số vận hành chính của nền tảng" />
      {uniqAlerts.length > 0 && (
        <div className="card p-5 mb-4 border-l-4 !border-l-amber-500">
          <div className="font-bold text-navy mb-2">Cảnh báo vận hành</div>
          <ul className="space-y-1.5 text-sm">
            {uniqAlerts.map((n) => (
              <li key={n.id} className="flex gap-2">
                <span className="badge bg-amber-100 text-amber-700 shrink-0">{n.type === "OPS_CIRCUIT_OPEN" ? "Circuit mở" : "UNKNOWN tồn đọng"}</span>
                <span>{n.title}{n.body ? <span className="text-slate-500"> — {n.body}</span> : null}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid md:grid-cols-3 gap-4">
        {cards.map(([label, value]) => (
          <div key={label} className="card p-5"><div className="text-sm text-slate-500">{label}</div><div className="text-2xl mt-1">{value}</div></div>
        ))}
      </div>
    </div>
  );
}
