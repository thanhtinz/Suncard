import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/api";
import { requireAuth, requirePermission } from "@/modules/security";

export const dynamic = "force-dynamic";

// Xuất báo cáo CSV (Excel mở được; BOM \uFEFF để Excel đọc đúng tiếng Việt).
// Cùng số liệu với trang Admin → Báo cáo theo tab. Quyền: reports.view.
type Cell = string | number | bigint;

function csvCell(v: Cell): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: Cell[][]): string {
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
function typeLabel(t: string) {
  return t === "TOPUP" ? "Nạp cước/game" : t === "CARD_PURCHASE" ? "Bán thẻ" : t === "EXCHANGE" ? "Đổi thẻ" : t;
}

export async function GET(req: Request) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "reports.view");
    const tab = new URL(req.url).searchParams.get("tab") ?? "tong-hop";
    let rows: Cell[][] = [];

    if (tab === "doi-the") {
      const orders = await prisma.order.findMany({ where: { type: "EXCHANGE", status: "SUCCESS" }, orderBy: { createdAt: "desc" }, take: 10000, select: { id: true } });
      const ids = orders.map((o) => o.id);
      const ex = ids.length > 0
        ? await prisma.exchangeOrder.findMany({ where: { orderId: { in: ids } }, select: { carrier: true, faceValueMinor: true, payoutMinor: true } })
        : [];
      const m = new Map<string, { count: number; face: bigint; payout: bigint }>();
      for (const e of ex) {
        const r = m.get(e.carrier) ?? { count: 0, face: BigInt(0), payout: BigInt(0) };
        r.count += 1; r.face += e.faceValueMinor; r.payout += e.payoutMinor ?? BigInt(0);
        m.set(e.carrier, r);
      }
      rows = [["Nhà mạng", "Số đơn", "Mệnh giá (VND)", "Thực nhận (VND)", "Lãi (VND)"],
        ...Array.from(m.entries()).sort((a, b) => b[1].count - a[1].count).map(([c, r]) => [c, r.count, r.face, r.payout, r.face - r.payout] as Cell[])];
    } else if (tab === "ban-the" || tab === "nap-cuoc") {
      const type = tab === "ban-the" ? "CARD_PURCHASE" : "TOPUP";
      const orders = await prisma.order.findMany({ where: { type, status: "SUCCESS" }, orderBy: { createdAt: "desc" }, take: 5000, select: { code: true, userId: true, totalMinor: true, createdAt: true } });
      const users = await prisma.user.findMany({ where: { id: { in: [...new Set(orders.map((o) => o.userId))] } }, select: { id: true, email: true } });
      const emails = new Map(users.map((u) => [u.id, u.email]));
      rows = [["Mã đơn", "Email khách", "Tổng tiền (VND)", "Thời gian"],
        ...orders.map((o) => [o.code, emails.get(o.userId) ?? o.userId, o.totalMinor, o.createdAt.toISOString().slice(0, 19).replace("T", " ")] as Cell[])];
    } else if (tab === "kho-the") {
      const byStatus = await prisma.cardInventory.groupBy({ by: ["status"], _count: { _all: true } });
      const batches = await prisma.cardBatch.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { code: true, source: true, totalCards: true, status: true, createdAt: true } });
      rows = [["Nhóm", "Tên", "Số lượng", "Ghi chú"],
        ...byStatus.map((r) => ["Trạng thái kho", r.status, r._count._all, ""] as Cell[]),
        ...batches.map((b) => ["Lô thẻ", b.code, b.totalCards, `${b.source} · ${b.status} · ${b.createdAt.toISOString().slice(0, 10)}`] as Cell[])];
    } else if (tab === "vi") {
      const monthStart = new Date(); monthStart.setUTCHours(0, 0, 0, 0); monthStart.setUTCDate(1);
      const [accounts, deposits, withdrawals] = await Promise.all([
        prisma.ledgerAccount.findMany({ where: { ownerType: "USER", kind: "AVAILABLE" }, select: { balanceMinor: true, heldMinor: true } }),
        prisma.deposit.groupBy({ by: ["status"], where: { createdAt: { gte: monthStart } }, _sum: { amountMinor: true }, _count: { _all: true } }),
        prisma.withdrawalRequest.groupBy({ by: ["status"], where: { createdAt: { gte: monthStart } }, _sum: { amountMinor: true }, _count: { _all: true } }),
      ]);
      rows = [["Chỉ tiêu", "Số lượng", "Tổng tiền (VND)"],
        ["Tổng số dư khả dụng của khách", accounts.length, accounts.reduce((s2, a) => s2 + a.balanceMinor, BigInt(0))],
        ["Tổng tiền đang giữ (hold)", "", accounts.reduce((s2, a) => s2 + a.heldMinor, BigInt(0))],
        ...deposits.map((d) => [`Nạp trong tháng — ${d.status}`, d._count._all, d._sum.amountMinor ?? BigInt(0)] as Cell[]),
        ...withdrawals.map((d) => [`Rút trong tháng — ${d.status}`, d._count._all, d._sum.amountMinor ?? BigInt(0)] as Cell[])];
    } else if (tab === "top-khach") {
      const orders = await prisma.order.findMany({ where: { status: "SUCCESS" }, orderBy: { createdAt: "desc" }, take: 10000, select: { userId: true, totalMinor: true } });
      const m = new Map<string, { count: number; total: bigint }>();
      for (const o of orders) {
        const r = m.get(o.userId) ?? { count: 0, total: BigInt(0) };
        r.count += 1; r.total += o.totalMinor;
        m.set(o.userId, r);
      }
      const top = Array.from(m.entries()).sort((a, b) => (b[1].total > a[1].total ? 1 : -1)).slice(0, 10);
      const users = await prisma.user.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: { id: true, email: true } });
      const emails = new Map(users.map((u) => [u.id, u.email]));
      rows = [["Hạng", "Email khách", "Số đơn", "Tổng tiền (VND)"],
        ...top.map(([id, r], i) => [i + 1, emails.get(id) ?? id, r.count, r.total] as Cell[])];
    } else {
      // tong-hop (mặc định)
      const orders = await prisma.order.findMany({ where: { status: "SUCCESS" }, orderBy: { createdAt: "desc" }, take: 10000, select: { id: true, type: true, totalMinor: true } });
      const m = new Map<string, { count: number; total: bigint }>();
      for (const o of orders) {
        const r = m.get(o.type) ?? { count: 0, total: BigInt(0) };
        r.count += 1; r.total += o.totalMinor;
        m.set(o.type, r);
      }
      const exIds = orders.filter((o) => o.type === "EXCHANGE").map((o) => o.id);
      const ex = exIds.length > 0
        ? await prisma.exchangeOrder.findMany({ where: { orderId: { in: exIds } }, select: { faceValueMinor: true, payoutMinor: true } })
        : [];
      const profit = ex.reduce((s2, e) => s2 + e.faceValueMinor - (e.payoutMinor ?? BigInt(0)), BigInt(0));
      rows = [["Dịch vụ", "Số đơn", "Doanh thu (VND)", "Lãi (VND)"],
        ...Array.from(m.entries()).map(([t, r]) => [typeLabel(t), r.count, r.total, t === "EXCHANGE" ? profit : ""] as Cell[])];
    }

    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="suncard-report-${tab}.csv"`,
      },
    });
  } catch (e) { return fail(e); }
}
