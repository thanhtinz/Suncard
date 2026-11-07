import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, Money, StatusBadge, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AccountDashboard() {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const uid = session.userId;
  const [avail, held, orders, notifs, profile] = await Promise.all([
    prisma.ledgerAccount.findUnique({ where: { code: `WALLET:${uid}:AVAILABLE` } }),
    prisma.ledgerAccount.findUnique({ where: { code: `WALLET:${uid}:HELD` } }),
    prisma.order.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.notification.findMany({ where: { userId: uid, readAt: null }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.userProfile.findUnique({ where: { userId: uid } }),
  ]);
  return (
    <div>
      <PageTitle title={`Xin chào${profile ? `, ${profile.fullName}` : ""}`} sub="Tổng quan tài khoản của bạn" />
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="card p-5"><div className="text-sm text-slate-500">Số dư khả dụng</div><div className="text-2xl mt-1 text-primary"><Money v={avail?.balanceMinor ?? BigInt(0)} /></div></div>
        <div className="card p-5"><div className="text-sm text-slate-500">Đang giữ (chờ xử lý)</div><div className="text-2xl mt-1"><Money v={held?.balanceMinor ?? BigInt(0)} /></div></div>
        <div className="card p-5"><div className="text-sm text-slate-500">Thông báo chưa đọc</div><div className="text-2xl mt-1">{notifs.length}</div></div>
      </div>
      <h2 className="font-bold text-navy mb-3">Đơn gần đây</h2>
      {orders.length === 0 ? <Empty text="Bạn chưa có đơn hàng nào" /> : (
        <div className="card divide-y divide-slate-100 mb-6">
          {orders.map((o) => (
            <Link key={o.id} href={`/tai-khoan/don-hang/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <span className="font-medium">{o.code}</span><span className="text-sm text-slate-500">{o.type}</span>
              <span className="ml-auto"><Money v={o.totalMinor} /></span><StatusBadge status={o.status} />
            </Link>
          ))}
        </div>
      )}
      <h2 className="font-bold text-navy mb-3">Thông báo mới</h2>
      {notifs.length === 0 ? <Empty text="Không có thông báo chưa đọc" /> : (
        <div className="card divide-y divide-slate-100">
          {notifs.map((n) => (<div key={n.id} className="px-4 py-3"><div className="font-medium text-sm">{n.title}</div>{n.body && <div className="text-sm text-slate-500">{n.body}</div>}</div>))}
        </div>
      )}
    </div>
  );
}
