import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, StatusBadge, Empty } from "@/components/ui";
import { getSession } from "@/modules/security";

export const dynamic = "force-dynamic";

const BASE = "/tai-khoan/lich-su-doi-the";
const CARRIERS = ["Viettel", "Mobifone", "Vinaphone", "Vietnamobile", "Garena", "Zing", "Vcoin", "Gate", "Scoin"];
const DENOMS = [5000, 10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000, 2000000, 5000000, 10000000];
const STATUS_GROUPS: { key: string; label: string; statuses: string[] | null }[] = [
  { key: "all", label: "Tất cả", statuses: null },
  { key: "success", label: "Thành công", statuses: ["SUCCESS"] },
  { key: "processing", label: "Đang xử lý", statuses: ["CREATED", "VALIDATING", "RESERVED", "SUBMITTING", "PENDING", "PROCESSING"] },
  { key: "verify", label: "Chờ xác minh", statuses: ["UNKNOWN", "REVIEW"] },
  { key: "failed", label: "Thất bại", statuses: ["FAILED"] },
  { key: "refund", label: "Hoàn tiền", statuses: ["REFUND_PENDING", "REFUNDED"] },
  { key: "cancelled", label: "Đã huỷ", statuses: ["CANCELLED"] },
];
const RANGES: { key: string; label: string }[] = [
  { key: "all", label: "Mọi thời gian" },
  { key: "today", label: "Hôm nay" },
  { key: "7d", label: "7 ngày qua" },
  { key: "30d", label: "30 ngày qua" },
  { key: "month", label: "Tháng này" },
];
const PAGE_SIZE = 20;

function rangeStart(key: string): Date | null {
  const now = new Date();
  if (key === "today") { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
  if (key === "7d") return new Date(now.getTime() - 7 * 86400 * 1000);
  if (key === "30d") return new Date(now.getTime() - 30 * 86400 * 1000);
  if (key === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  return null;
}

export default async function LichSuDoiThePage({ searchParams }: { searchParams?: { q?: string; st?: string; telco?: string; denom?: string; range?: string; sort?: string; page?: string } }) {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const q = (searchParams?.q ?? "").trim();
  const st = STATUS_GROUPS.some((g) => g.key === searchParams?.st) ? (searchParams!.st as string) : "all";
  const telco = CARRIERS.includes(searchParams?.telco ?? "") ? (searchParams!.telco as string) : "";
  const denom = DENOMS.includes(Number(searchParams?.denom)) ? String(Number(searchParams?.denom)) : "";
  const range = RANGES.some((r) => r.key === searchParams?.range) ? (searchParams!.range as string) : "all";
  const sort = ["newest", "oldest", "value_desc", "value_asc"].includes(searchParams?.sort ?? "") ? (searchParams!.sort as string) : "newest";
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const hasFilter = !!(q || st !== "all" || telco || denom || range !== "all" || sort !== "newest");

  const buildHref = (patch: Record<string, string>) => {
    const merged: Record<string, string> = { q, st, telco, denom, range, sort, page: String(page), ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (!v) continue;
      if (k === "st" && v === "all") continue;
      if (k === "range" && v === "all") continue;
      if (k === "sort" && v === "newest") continue;
      if (k === "page" && v === "1") continue;
      p.set(k, v);
    }
    const s = p.toString();
    return s ? `${BASE}?${s}` : BASE;
  };

  const uid = session.userId;
  // Đếm theo nhóm trạng thái cho hàng chip lọc.
  const grouped: { status: string; _count: { _all: number } }[] = await prisma.order.groupBy({ by: ["status"], where: { userId: uid, type: "EXCHANGE" }, _count: { _all: true } }).catch(() => []);
  const countOf = (statuses: string[] | null) => grouped.reduce((s, g) => (statuses === null || statuses.includes(g.status) ? s + g._count._all : s), 0);
  const totalAll = countOf(null);

  // Lọc phía ExchangeOrder (nhà mạng / mệnh giá / serial) → tập id ứng viên.
  let idFilter: string[] | null = null;
  if (telco || denom) {
    const rows = await prisma.exchangeOrder.findMany({
      where: { ...(telco ? { carrier: telco } : {}), ...(denom ? { faceValueMinor: BigInt(denom) } : {}) },
      select: { orderId: true },
    });
    idFilter = rows.map((r) => r.orderId);
  }
  if (q) {
    const [bySerial, byCode] = await Promise.all([
      prisma.exchangeOrder.findMany({ where: { serialMasked: { contains: q, mode: "insensitive" } }, select: { orderId: true } }),
      prisma.order.findMany({ where: { userId: uid, type: "EXCHANGE", code: { contains: q, mode: "insensitive" } }, select: { id: true } }),
    ]);
    const qIds = new Set([...bySerial.map((r) => r.orderId), ...byCode.map((r) => r.id)]);
    idFilter = idFilter === null ? [...qIds] : idFilter.filter((id) => qIds.has(id));
  }

  const group = STATUS_GROUPS.find((g) => g.key === st)!;
  const since = rangeStart(range);
  const orders = await prisma.order.findMany({
    where: {
      userId: uid, type: "EXCHANGE",
      ...(group.statuses ? { status: { in: group.statuses } } : {}),
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(idFilter ? { id: { in: idFilter } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  const exs = orders.length ? await prisma.exchangeOrder.findMany({ where: { orderId: { in: orders.map((o) => o.id) } } }) : [];
  const exMap = new Map(exs.map((e) => [e.orderId, e]));

  const sorted = [...orders].sort((a, b) => {
    if (sort === "oldest") return a.createdAt.getTime() - b.createdAt.getTime();
    if (sort === "value_desc" || sort === "value_asc") {
      const va = exMap.get(a.id)?.faceValueMinor ?? BigInt(0);
      const vb = exMap.get(b.id)?.faceValueMinor ?? BigInt(0);
      return sort === "value_desc" ? (vb > va ? 1 : vb < va ? -1 : 0) : (va > vb ? 1 : va < vb ? -1 : 0);
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageOrders = sorted.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  return (
    <div>
      <PageTitle title="Lịch sử đổi thẻ" sub={`Tổng ${totalAll} đơn đổi thẻ`} />

      <div className="card p-4 mb-4">
        <form method="get" className="space-y-3">
          <input type="hidden" name="st" value={st} />
          <div className="flex flex-col sm:flex-row gap-2.5">
            <label className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <i className="fa-solid fa-magnifying-glass text-[14px]" aria-hidden="true" />
              </span>
              <input name="q" defaultValue={q} className="input !py-2.5 !pl-10 w-full" placeholder="Tìm theo mã đơn hoặc số serial…" aria-label="Tìm kiếm đơn đổi thẻ" />
            </label>
            <div className="flex gap-2.5 shrink-0">
              <button className="btn-primary whitespace-nowrap flex-1 sm:flex-none">Lọc</button>
              {hasFilter && <Link href={BASE} className="btn-ghost whitespace-nowrap flex-1 sm:flex-none text-center">Đặt lại</Link>}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <span>
              <label className="label" htmlFor="f-telco">Nhà mạng</label>
              <select id="f-telco" name="telco" defaultValue={telco} className="input">
                <option value="">Tất cả nhà mạng</option>
                {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </span>
            <span>
              <label className="label" htmlFor="f-denom">Mệnh giá</label>
              <select id="f-denom" name="denom" defaultValue={denom} className="input">
                <option value="">Tất cả mệnh giá</option>
                {DENOMS.map((d) => <option key={d} value={d}>{d.toLocaleString("vi-VN")}₫</option>)}
              </select>
            </span>
            <span>
              <label className="label" htmlFor="f-range">Thời gian</label>
              <select id="f-range" name="range" defaultValue={range} className="input">
                {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </span>
            <span>
              <label className="label" htmlFor="f-sort">Sắp xếp</label>
              <select id="f-sort" name="sort" defaultValue={sort} className="input">
                <option value="newest">Mới nhất trước</option>
                <option value="oldest">Cũ nhất trước</option>
                <option value="value_desc">Mệnh giá cao → thấp</option>
                <option value="value_asc">Mệnh giá thấp → cao</option>
              </select>
            </span>
          </div>
        </form>
        <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-orange-100">
          <span className="text-sm font-semibold text-navy mr-1">Trạng thái:</span>
          {STATUS_GROUPS.map((g) => {
            const on = g.key === st;
            return (
              <Link key={g.key} href={buildHref({ st: g.key, page: "1" })} className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-[13px] font-bold whitespace-nowrap ${on ? "bg-grad-sun text-white border-transparent shadow-sun" : "bg-white border-sunline text-ink2 hover:border-[#FFB03A]"}`}>
                {g.label} <span className={on ? "text-white/85" : "text-slate-400"}>({countOf(g.statuses)})</span>
              </Link>
            );
          })}
        </div>
      </div>

      {totalAll === 0 ? (
        <div>
          <Empty text="Bạn chưa có đơn đổi thẻ nào" />
          <div className="text-center"><Link href="/" className="btn-primary inline-flex">Đổi thẻ ngay</Link></div>
        </div>
      ) : totalFiltered === 0 ? (
        <div>
          <Empty text="Không có đơn nào khớp với bộ lọc hiện tại" />
          <div className="text-center"><Link href={BASE} className="btn-ghost inline-flex">Xoá bộ lọc</Link></div>
        </div>
      ) : (
        <>
          <DataTable cols={["Mã đơn", "Nhà mạng", "Serial", "Mệnh giá", "Thực nhận", "Trạng thái", "Thời gian"]} rows={pageOrders.map((o) => {
            const ex = exMap.get(o.id);
            return [
              <Link key="c" href={`/tai-khoan/don-hang/${o.id}`} className="font-medium text-sundeep whitespace-nowrap">{o.code}</Link>,
              ex?.carrier ?? "", ex?.serialMasked ?? "—",
              ex ? <Money key="f" v={ex.faceValueMinor} /> : "",
              ex?.payoutMinor != null ? <Money key="p" v={ex.payoutMinor} /> : "—",
              <StatusBadge key="s" status={o.status} />,
              <span key="t" className="whitespace-nowrap">{o.createdAt.toLocaleString("vi-VN")}</span>,
            ];
          })} />
          {totalPages > 1 && (
            <div className="flex gap-2 mt-4 text-sm">
              {curPage > 1 && <Link className="btn-ghost" href={buildHref({ page: String(curPage - 1) })}>Trang trước</Link>}
              <span className="px-2 py-2">Trang {curPage}/{totalPages}</span>
              {curPage < totalPages && <Link className="btn-ghost" href={buildHref({ page: String(curPage + 1) })}>Trang sau</Link>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
