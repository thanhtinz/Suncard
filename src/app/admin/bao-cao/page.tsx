import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "tong-hop", label: "Tổng hợp" },
  { id: "doi-the", label: "Đổi thẻ" },
  { id: "ban-the", label: "Bán thẻ" },
  { id: "nap-cuoc", label: "Nạp cước" },
  { id: "kho-the", label: "Kho thẻ" },
  { id: "vi", label: "Ví" },
  { id: "top-khach", label: "Top khách" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function startOfDayUTC(d: Date): Date { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x; }
function startOfMonthUTC(d: Date): Date { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); x.setUTCDate(1); return x; }

function typeLabel(t: string) {
  return t === "TOPUP" ? "Nạp cước/game" : t === "CARD_PURCHASE" ? "Bán thẻ" : t === "EXCHANGE" ? "Đổi thẻ" : t;
}

async function userEmails(ids: string[]) {
  const m = new Map<string, string>();
  if (ids.length === 0) return m;
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } });
  for (const u of users) m.set(u.id, u.email);
  return m;
}

export default async function AdminReportsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const tab = (typeof searchParams?.tab === "string" && (TABS as readonly { id: string }[]).some((t) => t.id === searchParams.tab) ? searchParams.tab : "tong-hop") as TabId;
  const now = new Date();
  const todayStart = startOfDayUTC(now);
  const monthStart = startOfMonthUTC(now);

  return (
    <div>
      <PageTitle
        title="Báo cáo"
        sub="Số liệu thật từ đơn hàng, kho thẻ và ví — tính trên tối đa 10.000 đơn thành công gần nhất cho mỗi phần"
        action={<a className="btn-primary" href={`/api/admin/reports/export?tab=${tab}`}><i className="fa-solid fa-file-export mr-2" aria-hidden="true" />Xuất Excel</a>}
      />
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => (
          <Link key={t.id} href={`/admin/bao-cao?tab=${t.id}`} className={`px-3.5 py-2 rounded-full text-sm font-semibold border ${tab === t.id ? "bg-navy text-white border-navy" : "bg-white text-navy border-slate-200 hover:border-navy"}`}>{t.label}</Link>
        ))}
      </div>
      {tab === "tong-hop" && <TongHop todayStart={todayStart} monthStart={monthStart} />}
      {tab === "doi-the" && <DoiThe />}
      {tab === "ban-the" && <OrdersByType type="CARD_PURCHASE" label="Bán thẻ" todayStart={todayStart} monthStart={monthStart} />}
      {tab === "nap-cuoc" && <OrdersByType type="TOPUP" label="Nạp cước/game" todayStart={todayStart} monthStart={monthStart} />}
      {tab === "kho-the" && <KhoThe />}
      {tab === "vi" && <Vi monthStart={monthStart} />}
      {tab === "top-khach" && <TopKhach />}
    </div>
  );
}

// ---------- Tổng hợp ----------
async function TongHop({ todayStart, monthStart }: { todayStart: Date; monthStart: Date }) {
  const orders = await prisma.order.findMany({ where: { status: "SUCCESS" }, orderBy: { createdAt: "desc" }, take: 10000, select: { id: true, type: true, totalMinor: true, createdAt: true } });
  type Agg = { count: number; total: bigint };
  const agg = (rows: typeof orders) => {
    const m = new Map<string, Agg>();
    for (const o of rows) { const r = m.get(o.type) ?? { count: 0, total: BigInt(0) }; r.count += 1; r.total += o.totalMinor; m.set(o.type, r); }
    return m;
  };
  const today = agg(orders.filter((o) => o.createdAt >= todayStart));
  const month = agg(orders.filter((o) => o.createdAt >= monthStart));
  // Lãi đổi thẻ = mệnh giá − thực nhận (ExchangeOrder của đơn SUCCESS). Bán thẻ và
  // nạp cước chưa ghi chi phí nhà cung cấp nên không tính lãi ở đây.
  const exIds = new Set(orders.filter((o) => o.type === "EXCHANGE").map((o) => o.id));
  const exByOrder = new Map(orders.filter((o) => o.type === "EXCHANGE").map((o) => [o.id, o.createdAt]));
  const exOrders = exIds.size > 0
    ? await prisma.exchangeOrder.findMany({ where: { orderId: { in: [...exIds] } }, select: { orderId: true, faceValueMinor: true, payoutMinor: true } })
    : [];
  let profitToday = BigInt(0), profitMonth = BigInt(0);
  for (const e of exOrders) {
    const profit = e.faceValueMinor - (e.payoutMinor ?? BigInt(0));
    const at = exByOrder.get(e.orderId);
    if (!at) continue;
    if (at >= monthStart) profitMonth += profit;
    if (at >= todayStart) profitToday += profit;
  }
  return (
    <div className="space-y-8">
      <h2 className="font-bold text-navy">Hôm nay</h2>
      {today.size === 0 ? <Empty text="Chưa có doanh thu hôm nay" /> : (
        <DataTable cols={["Dịch vụ", "Số đơn", "Doanh thu", "Lãi (đổi thẻ)"]} rows={Array.from(today.entries()).map(([t, r]) => [
          typeLabel(t), String(r.count), <Money key="t" v={r.total} />,
          t === "EXCHANGE" ? <Money key="p" v={profitToday} /> : "—",
        ])} />
      )}
      <h2 className="font-bold text-navy">Tháng này</h2>
      {month.size === 0 ? <Empty text="Chưa có doanh thu tháng này" /> : (
        <DataTable cols={["Dịch vụ", "Số đơn", "Doanh thu", "Lãi (đổi thẻ)"]} rows={Array.from(month.entries()).map(([t, r]) => [
          typeLabel(t), String(r.count), <Money key="t" v={r.total} />,
          t === "EXCHANGE" ? <Money key="p" v={profitMonth} /> : "—",
        ])} />
      )}
      <p className="text-xs text-slate-400">Lãi chỉ tính được cho dịch vụ đổi thẻ (mệnh giá − thực nhận); bán thẻ và nạp cước chưa ghi chi phí nhà cung cấp nên chưa tính lãi ở đây.</p>
    </div>
  );
}

// ---------- Đổi thẻ theo nhà mạng ----------
async function DoiThe() {
  const orders = await prisma.order.findMany({ where: { type: "EXCHANGE", status: "SUCCESS" }, orderBy: { createdAt: "desc" }, take: 10000, select: { id: true } });
  const ids = orders.map((o) => o.id);
  const ex = ids.length > 0
    ? await prisma.exchangeOrder.findMany({ where: { orderId: { in: ids } }, select: { carrier: true, faceValueMinor: true, payoutMinor: true } })
    : [];
  type Agg = { count: number; face: bigint; payout: bigint };
  const m = new Map<string, Agg>();
  for (const e of ex) {
    const r = m.get(e.carrier) ?? { count: 0, face: BigInt(0), payout: BigInt(0) };
    r.count += 1; r.face += e.faceValueMinor; r.payout += e.payoutMinor ?? BigInt(0);
    m.set(e.carrier, r);
  }
  const rows = Array.from(m.entries()).sort((a, b) => b[1].count - a[1].count);
  const totFace = rows.reduce((s, [, r]) => s + r.face, BigInt(0));
  const totPayout = rows.reduce((s, [, r]) => s + r.payout, BigInt(0));
  if (rows.length === 0) return <Empty text="Chưa có đơn đổi thẻ thành công" />;
  return (
    <div className="space-y-6">
      <DataTable cols={["Nhà mạng", "Số đơn", "Mệnh giá", "Thực nhận", "Lãi"]} rows={rows.map(([c, r]) => [
        c, String(r.count), <Money key="f" v={r.face} />, <Money key="p" v={r.payout} />, <Money key="l" v={r.face - r.payout} />,
      ])} />
      <p className="text-sm text-slate-500">Tổng: {ex.length} đơn · mệnh giá <Money v={totFace} /> · thực nhận <Money v={totPayout} /> · lãi <Money v={totFace - totPayout} />.</p>
    </div>
  );
}

// ---------- Bán thẻ / Nạp cước ----------
async function OrdersByType({ type, label, todayStart, monthStart }: { type: string; label: string; todayStart: Date; monthStart: Date }) {
  const orders = await prisma.order.findMany({ where: { type, status: "SUCCESS" }, orderBy: { createdAt: "desc" }, take: 10000, select: { id: true, code: true, userId: true, totalMinor: true, createdAt: true } });
  const emails = await userEmails([...new Set(orders.map((o) => o.userId))]);
  const sum = (rows: typeof orders) => rows.reduce((s, o) => s + o.totalMinor, BigInt(0));
  const today = orders.filter((o) => o.createdAt >= todayStart);
  const month = orders.filter((o) => o.createdAt >= monthStart);
  if (orders.length === 0) return <Empty text={`Chưa có đơn ${label} thành công`} />;
  return (
    <div className="space-y-8">
      <DataTable cols={["Kỳ", "Số đơn", "Doanh thu"]} rows={[
        ["Hôm nay", String(today.length), <Money key="t" v={sum(today)} />],
        ["Tháng này", String(month.length), <Money key="m" v={sum(month)} />],
        ["Toàn bộ", String(orders.length), <Money key="a" v={sum(orders)} />],
      ]} />
      <h2 className="font-bold text-navy">20 đơn gần nhất</h2>
      <DataTable cols={["Mã đơn", "Khách hàng", "Tổng tiền", "Thời gian"]} rows={orders.slice(0, 20).map((o) => [
        o.code, emails.get(o.userId) ?? o.userId, <Money key="m" v={o.totalMinor} />, o.createdAt.toISOString().slice(0, 19).replace("T", " "),
      ])} />
    </div>
  );
}

// ---------- Kho thẻ ----------
async function KhoThe() {
  const byStatus = await prisma.cardInventory.groupBy({ by: ["status"], _count: { _all: true } });
  const batches = await prisma.cardBatch.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { code: true, source: true, variantId: true, totalCards: true, status: true, createdAt: true } });
  const total = byStatus.reduce((s, r) => s + r._count._all, 0);
  return (
    <div className="space-y-8">
      <h2 className="font-bold text-navy">Tồn kho theo trạng thái ({total} mã)</h2>
      {byStatus.length === 0 ? <Empty text="Kho thẻ trống" /> : (
        <DataTable cols={["Trạng thái", "Số mã"]} rows={byStatus.sort((a, b) => b._count._all - a._count._all).map((r) => [r.status, String(r._count._all)])} />
      )}
      <h2 className="font-bold text-navy">Lô thẻ gần nhất</h2>
      {batches.length === 0 ? <Empty text="Chưa có lô thẻ nào" /> : (
        <DataTable cols={["Mã lô", "Nguồn", "Biến thể", "Tổng số thẻ", "Trạng thái", "Ngày nhập"]} rows={batches.map((b) => [
          b.code, b.source, b.variantId, String(b.totalCards), b.status, b.createdAt.toISOString().slice(0, 10),
        ])} />
      )}
    </div>
  );
}

// ---------- Ví ----------
async function Vi({ monthStart }: { monthStart: Date }) {
  const [accounts, deposits, withdrawals] = await Promise.all([
    prisma.ledgerAccount.findMany({ where: { ownerType: "USER", kind: "AVAILABLE" }, select: { balanceMinor: true, heldMinor: true } }),
    prisma.deposit.groupBy({ by: ["status"], where: { createdAt: { gte: monthStart } }, _sum: { amountMinor: true }, _count: { _all: true } }),
    prisma.withdrawalRequest.groupBy({ by: ["status"], where: { createdAt: { gte: monthStart } }, _sum: { amountMinor: true }, _count: { _all: true } }),
  ]);
  const totalBalance = accounts.reduce((s, a) => s + a.balanceMinor, BigInt(0));
  const totalHeld = accounts.reduce((s, a) => s + a.heldMinor, BigInt(0));
  return (
    <div className="space-y-8">
      <DataTable cols={["Chỉ tiêu", "Giá trị"]} rows={[
        ["Tổng số dư khả dụng của khách", <Money key="b" v={totalBalance} />],
        ["Tổng tiền đang giữ (hold)", <Money key="h" v={totalHeld} />],
        ["Số ví khách", String(accounts.length)],
      ]} />
      <h2 className="font-bold text-navy">Nạp tiền trong tháng (theo trạng thái)</h2>
      {deposits.length === 0 ? <Empty text="Chưa có yêu cầu nạp trong tháng" /> : (
        <DataTable cols={["Trạng thái", "Số yêu cầu", "Tổng tiền"]} rows={deposits.map((d) => [d.status, String(d._count._all), <Money key="m" v={d._sum.amountMinor ?? BigInt(0)} />])} />
      )}
      <h2 className="font-bold text-navy">Rút tiền trong tháng (theo trạng thái)</h2>
      {withdrawals.length === 0 ? <Empty text="Chưa có yêu cầu rút trong tháng" /> : (
        <DataTable cols={["Trạng thái", "Số yêu cầu", "Tổng tiền"]} rows={withdrawals.map((d) => [d.status, String(d._count._all), <Money key="m" v={d._sum.amountMinor ?? BigInt(0)} />])} />
      )}
    </div>
  );
}

// ---------- Top khách ----------
async function TopKhach() {
  const orders = await prisma.order.findMany({ where: { status: "SUCCESS" }, orderBy: { createdAt: "desc" }, take: 10000, select: { userId: true, totalMinor: true } });
  type Agg = { count: number; total: bigint };
  const m = new Map<string, Agg>();
  for (const o of orders) {
    const r = m.get(o.userId) ?? { count: 0, total: BigInt(0) };
    r.count += 1; r.total += o.totalMinor;
    m.set(o.userId, r);
  }
  const top = Array.from(m.entries()).sort((a, b) => (b[1].total > a[1].total ? 1 : -1)).slice(0, 10);
  const emails = await userEmails(top.map(([id]) => id));
  if (top.length === 0) return <Empty text="Chưa có đơn thành công" />;
  return (
    <DataTable cols={["#", "Khách hàng", "Số đơn", "Tổng tiền đơn thành công"]} rows={top.map(([id, r], i) => [
      String(i + 1), emails.get(id) ?? id, String(r.count), <Money key="m" v={r.total} />,
    ])} />
  );
}
