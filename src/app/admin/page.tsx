import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Money } from "@/components/ui";

export const dynamic = "force-dynamic";

// Bảng quản trị: doanh thu + lãi từng dịch vụ (hôm nay & tháng này), thẻ chỉ số
// quỹ, danh sách việc cần xử lý và các panel đơn mới nhất — bố cục theo chuẩn
// trang quản trị hệ thống thẻ cào.
const SERVICES = [
  { type: "EXCHANGE", label: "Đổi thẻ cào", note: "Thanh toán: trả khách", icon: "fa-arrow-right-arrow-left", href: "/admin/doi-the" },
  { type: "CARD_PURCHASE", label: "Bán thẻ cào", note: "Thanh toán: khách trả", icon: "fa-credit-card", href: "/admin/don-ban-the" },
  { type: "TOPUP", label: "Nạp cước/game", note: "Thanh toán: khách trả", icon: "fa-mobile-screen-button", href: "/admin/don-nap" },
] as const;

function StatCard({ label, icon, chip, children, sub }: { label: string; icon: string; chip: string; children: React.ReactNode; sub: string }) {
  return (
    <div className="card flex items-start justify-between gap-2 p-4">
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-slate-500">{label}</div>
        <div className="mt-1 truncate text-[19px] font-extrabold text-slate-900">{children}</div>
        <div className="mt-0.5 truncate text-[11.5px] text-slate-400">{sub}</div>
      </div>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${chip}`}><i className={`fa-solid ${icon} text-[16px]`} aria-hidden="true" /></span>
    </div>
  );
}

export default async function AdminOverview() {
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);

  const svcAgg = async (type: string, from: Date) => prisma.order.aggregate({
    where: { type, status: "SUCCESS", createdAt: { gte: from } },
    _count: true, _sum: { totalMinor: true },
  }).catch(() => ({ _count: 0, _sum: { totalMinor: null as bigint | null } }));
  const exchangeProfit = async (from: Date) => {
    const orders = await prisma.order.findMany({ where: { type: "EXCHANGE", status: "SUCCESS", createdAt: { gte: from } }, select: { id: true } }).catch(() => []);
    if (!orders.length) return { face: BigInt(0), profit: BigInt(0) };
    const rows = await prisma.exchangeOrder.findMany({ where: { orderId: { in: orders.map((o) => o.id) } }, select: { faceValueMinor: true, payoutMinor: true } }).catch(() => []);
    let face = BigInt(0), profit = BigInt(0);
    for (const r of rows) { face += r.faceValueMinor; if (r.payoutMinor != null) profit += r.faceValueMinor - r.payoutMinor; }
    return { face, profit };
  };

  const [
    fund, depositsMonth, withdrawalsMonth, refundsTotal,
    pendingWithdrawals, pendingDeposits, unknownOrders, reconOpen, riskPending, kycPending, apiPending, agentPending,
    latestDeposits, latestWithdrawals, latestTransfers, latestUsers, usersTotal, usersToday, opsAlerts,
    ...svcData
  ] = await Promise.all([
    prisma.ledgerAccount.aggregate({ where: { code: { startsWith: "WALLET:" }, kind: "AVAILABLE" }, _sum: { balanceMinor: true } }).catch(() => ({ _sum: { balanceMinor: null as bigint | null } })),
    prisma.deposit.aggregate({ where: { status: "APPROVED", createdAt: { gte: month } }, _sum: { amountMinor: true } }).catch(() => ({ _sum: { amountMinor: null as bigint | null } })),
    prisma.withdrawalRequest.aggregate({ where: { status: "PAID", createdAt: { gte: month } }, _sum: { amountMinor: true } }).catch(() => ({ _sum: { amountMinor: null as bigint | null } })),
    prisma.refund.aggregate({ where: { status: "COMPLETED" }, _sum: { amountMinor: true } }).catch(() => ({ _sum: { amountMinor: null as bigint | null } })),
    prisma.withdrawalRequest.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.deposit.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.order.count({ where: { status: "UNKNOWN" } }).catch(() => 0),
    prisma.reconciliationCase.count({ where: { status: "OPEN" } }).catch(() => 0),
    prisma.riskReview.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.verificationRecord.count({ where: { type: "KYC", status: "PENDING" } }).catch(() => 0),
    prisma.apiClient.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.agentApplication.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.deposit.findMany({ orderBy: { createdAt: "desc" }, take: 5 }).catch(() => []),
    prisma.withdrawalRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 5 }).catch(() => []),
    prisma.walletTransfer.findMany({ orderBy: { createdAt: "desc" }, take: 5 }).catch(() => []),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, email: true, createdAt: true } }).catch(() => []),
    prisma.user.count().catch(() => 0),
    prisma.user.count({ where: { createdAt: { gte: today } } }).catch(() => 0),
    prisma.notification.findMany({ where: { type: { in: ["OPS_UNKNOWN_BACKLOG", "OPS_CIRCUIT_OPEN"] }, createdAt: { gte: new Date(Date.now() - 7 * 86400 * 1000) } }, orderBy: { createdAt: "desc" }, take: 3 }).catch(() => []),
    ...SERVICES.flatMap((s) => [svcAgg(s.type, today), svcAgg(s.type, month)]),
    exchangeProfit(today), exchangeProfit(month),
  ]);
  const agg = (i: number) => svcData[i] as { _count: number; _sum: { totalMinor: bigint | null } };
  const exToday = svcData[6] as { face: bigint; profit: bigint };
  const exMonth = svcData[7] as { face: bigint; profit: bigint };

  const tasks: { label: string; count: number; href: string }[] = [
    { label: "Đơn rút tiền chờ duyệt", count: pendingWithdrawals, href: "/admin/tai-chinh" },
    { label: "Đơn nạp tiền chờ duyệt", count: pendingDeposits, href: "/admin/tai-chinh" },
    { label: "Đơn đang chờ xác minh (UNKNOWN)", count: unknownOrders, href: "/admin/doi-the" },
    { label: "Ca đối soát đang mở", count: reconOpen, href: "/admin/doi-soat" },
    { label: "Cảnh báo rủi ro chờ duyệt", count: riskPending, href: "/admin/rui-ro" },
    { label: "Hồ sơ xác minh danh tính chờ", count: kycPending, href: "/admin/xac-minh" },
    { label: "Kết nối API chờ duyệt", count: apiPending, href: "/admin/api-clients" },
    { label: "Đơn đăng ký đại lý chờ duyệt", count: agentPending, href: "/admin/dai-ly" },
  ];
  const taskTotal = tasks.reduce((a, t) => a + t.count, 0);
  const userEmails = async (ids: string[]) => {
    if (!ids.length) return new Map<string, string>();
    const us = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } }).catch(() => []);
    return new Map(us.map((u) => [u.id, u.email]));
  };
  const depEmails = await userEmails(latestDeposits.map((d) => d.userId));
  const wdEmails = await userEmails(latestWithdrawals.map((w) => w.userId));
  const fmtDay = (d: Date) => d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[20px] font-extrabold text-slate-900">Bảng quản trị</h1>
          <p className="text-[13px] text-slate-500">Số liệu hôm nay {now.toLocaleDateString("vi-VN")}, kèm luỹ kế từ đầu tháng.</p>
        </div>
        <Link href="/admin/bao-cao" className="btn-ghost !px-3.5 !py-2 text-[13px]"><i className="fa-solid fa-chart-column" aria-hidden="true" /> Báo cáo tổng hợp</Link>
      </div>

      {opsAlerts.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          <span className="font-bold"><i className="fa-solid fa-triangle-exclamation mr-1.5" aria-hidden="true" />Cảnh báo vận hành:</span>{" "}
          {opsAlerts[0].title ?? "Có cảnh báo từ tác vụ tự động"} — xem thêm ở mục Tác vụ tự động.
        </div>
      )}
      {taskTotal > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
          <span>Có <b>{taskTotal} việc đang chờ xử lý</b> (rút/nạp tiền, đối soát, rủi ro, duyệt hồ sơ…).</span>
          <a href="#viec-can-xu-ly" className="ml-auto font-bold underline underline-offset-2">Xem việc cần xử lý</a>
        </div>
      )}

      {/* Thẻ chỉ số */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
        <StatCard label="Đổi thẻ cào" icon="fa-arrow-right-arrow-left" chip="bg-rose-50 text-rose-500" sub="Hôm nay"><Money v={agg(0)._sum.totalMinor ?? 0} /></StatCard>
        <StatCard label="Bán thẻ cào" icon="fa-credit-card" chip="bg-sky-50 text-sky-500" sub="Hôm nay"><Money v={agg(2)._sum.totalMinor ?? 0} /></StatCard>
        <StatCard label="Nạp cước/game" icon="fa-mobile-screen-button" chip="bg-violet-50 text-violet-500" sub="Hôm nay"><Money v={agg(4)._sum.totalMinor ?? 0} /></StatCard>
        <StatCard label="Số dư quỹ" icon="fa-wallet" chip="bg-amber-50 text-amber-500" sub="Tổng số dư ví thành viên"><Money v={fund._sum.balanceMinor ?? 0} /></StatCard>
        <StatCard label="Nạp quỹ" icon="fa-arrow-down" chip="bg-emerald-50 text-emerald-500" sub="Tháng này"><Money v={depositsMonth._sum.amountMinor ?? 0} /></StatCard>
        <StatCard label="Tổng hoàn tiền" icon="fa-rotate-left" chip="bg-slate-100 text-slate-500" sub="Hoàn đã hoàn tất"><Money v={refundsTotal._sum.amountMinor ?? 0} /></StatCard>
        <StatCard label="Rút quỹ" icon="fa-arrow-up" chip="bg-rose-50 text-rose-500" sub="Tháng này (đã chi)"><Money v={withdrawalsMonth._sum.amountMinor ?? 0} /></StatCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* Kết quả kinh doanh */}
        <div className="card overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-[14.5px] font-extrabold text-slate-800">Kết quả kinh doanh</span>
            <span className="text-[11.5px] text-slate-400">Đơn hoàn thành (SUCCESS)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table min-w-[640px]">
              <thead>
                <tr>
                  <th rowSpan={2}>Dịch vụ</th>
                  <th colSpan={3} className="border-l border-slate-100 text-center">Hôm nay</th>
                  <th colSpan={3} className="border-l border-slate-100 text-center">Tháng này</th>
                </tr>
                <tr>
                  <th className="border-l border-slate-100 text-right">Đơn</th><th className="text-right">Tổng tiền</th><th className="text-right">Lãi</th>
                  <th className="border-l border-slate-100 text-right">Đơn</th><th className="text-right">Tổng tiền</th><th className="text-right">Lãi</th>
                </tr>
              </thead>
              <tbody>
                {SERVICES.map((s, i) => {
                  const t = agg(i * 2), m = agg(i * 2 + 1);
                  const profitT = s.type === "EXCHANGE" ? exToday.profit : null;
                  const profitM = s.type === "EXCHANGE" ? exMonth.profit : null;
                  return (
                    <tr key={s.type}>
                      <td>
                        <Link href={s.href} className="font-bold text-slate-800 hover:text-[#D92D20]">{s.label}</Link>
                        <span className="block text-[11.5px] font-normal text-slate-400">{s.note}</span>
                      </td>
                      <td className="border-l border-slate-100 text-right">{t._count}</td>
                      <td className="text-right"><Money v={t._sum.totalMinor ?? 0} /></td>
                      <td className="text-right">{profitT == null ? <span className="text-slate-300">—</span> : <span className="font-semibold text-emerald-600"><Money v={profitT} /></span>}</td>
                      <td className="border-l border-slate-100 text-right">{m._count}</td>
                      <td className="text-right"><Money v={m._sum.totalMinor ?? 0} /></td>
                      <td className="text-right">{profitM == null ? <span className="text-slate-300">—</span> : <span className="font-semibold text-emerald-600"><Money v={profitM} /></span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-4 py-2.5 text-[11.5px] text-slate-400">Lãi đổi thẻ = mệnh giá − thực nhận của đơn thành công. Bán thẻ và nạp cước chưa lưu giá vốn nên chưa tính lãi theo đơn.</p>
        </div>

        {/* Việc cần xử lý */}
        <div className="card overflow-hidden" id="viec-can-xu-ly">
          <div className="border-b border-slate-100 px-4 py-3 text-[14.5px] font-extrabold text-slate-800">Việc cần xử lý</div>
          <ul>
            {tasks.map((t) => (
              <li key={t.label}>
                <Link href={t.href} className="flex items-center gap-2 border-b border-slate-50 px-4 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50">
                  <span className="flex-1 truncate">{t.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-extrabold ${t.count > 0 ? "bg-rose-50 text-[#D92D20]" : "bg-slate-100 text-slate-400"}`}>{t.count}</span>
                  <i className="fa-solid fa-chevron-right text-[10px] text-slate-300" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Panel đơn mới nhất */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-[13.5px] font-extrabold text-slate-800">Đơn nạp tiền</span>
            <Link href="/admin/tai-chinh" className="text-[12px] font-bold text-[#D92D20]">Xem thêm ›</Link>
          </div>
          {latestDeposits.length === 0 ? <p className="px-4 py-5 text-center text-[12.5px] text-slate-400">Không có dữ liệu</p> : (
            <ul>{latestDeposits.map((d) => (
              <li key={d.id} className="flex items-center gap-2 border-b border-slate-50 px-4 py-2.5 text-[12.5px]">
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-700">{depEmails.get(d.userId) ?? "—"}</span><span className="text-slate-400">{fmtDay(d.createdAt)} · {d.status}</span></span>
                <span className="font-bold text-slate-800"><Money v={d.amountMinor} /></span>
              </li>
            ))}</ul>
          )}
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-[13.5px] font-extrabold text-slate-800">Đơn rút tiền chờ duyệt</span>
            <Link href="/admin/tai-chinh" className="text-[12px] font-bold text-[#D92D20]">Xem thêm ›</Link>
          </div>
          {latestWithdrawals.length === 0 ? <p className="px-4 py-5 text-center text-[12.5px] text-slate-400">Không có đơn đang chờ</p> : (
            <ul>{latestWithdrawals.map((w) => (
              <li key={w.id} className="flex items-center gap-2 border-b border-slate-50 px-4 py-2.5 text-[12.5px]">
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-700">{wdEmails.get(w.userId) ?? "—"}</span><span className="text-slate-400">{fmtDay(w.createdAt)}</span></span>
                <span className="font-bold text-slate-800"><Money v={w.amountMinor} /></span>
              </li>
            ))}</ul>
          )}
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-[13.5px] font-extrabold text-slate-800">Chuyển số dư</span>
            <Link href="/admin/vi-ledger" className="text-[12px] font-bold text-[#D92D20]">Xem thêm ›</Link>
          </div>
          {latestTransfers.length === 0 ? <p className="px-4 py-5 text-center text-[12.5px] text-slate-400">Không có dữ liệu</p> : (
            <ul>{latestTransfers.map((t) => (
              <li key={t.id} className="flex items-center gap-2 border-b border-slate-50 px-4 py-2.5 text-[12.5px]">
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-700">Chuyển nội bộ</span><span className="text-slate-400">{fmtDay(t.createdAt)} · phí <Money v={t.feeMinor} /></span></span>
                <span className="font-bold text-slate-800"><Money v={t.amountMinor} /></span>
              </li>
            ))}</ul>
          )}
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-[13.5px] font-extrabold text-slate-800">Người dùng</span>
            <span className="text-[11.5px] text-slate-400">Hôm nay {usersToday} · Tổng {usersTotal}</span>
            <Link href="/admin/nguoi-dung" className="text-[12px] font-bold text-[#D92D20]">Xem thêm ›</Link>
          </div>
          {latestUsers.length === 0 ? <p className="px-4 py-5 text-center text-[12.5px] text-slate-400">Không có dữ liệu</p> : (
            <ul>{latestUsers.map((u) => (
              <li key={u.id} className="flex items-center gap-2 border-b border-slate-50 px-4 py-2.5 text-[12.5px]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[11px] font-extrabold text-white">{(u.email.charAt(0) || "U").toUpperCase()}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-700">{u.email}</span><span className="text-slate-400">{fmtDay(u.createdAt)}</span></span>
              </li>
            ))}</ul>
          )}
        </div>
      </div>
    </div>
  );
}
