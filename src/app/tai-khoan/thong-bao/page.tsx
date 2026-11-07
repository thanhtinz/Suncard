import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({ searchParams }: { searchParams?: { page?: string } }) {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 30;
  const notifs = await prisma.notification.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take });
  return (
    <div>
      <PageTitle title="Thông báo" sub="Cập nhật về đơn hàng, ví và hỗ trợ" />
      {notifs.length === 0 ? <Empty text="Bạn chưa có thông báo nào" /> : (
        <div className="card divide-y divide-slate-100">
          {notifs.map((n) => (
            <div key={n.id} className={`px-4 py-3 ${n.readAt ? "" : "bg-blue-50/50"}`}>
              <div className="flex items-center gap-2"><span className="font-medium text-sm">{n.title}</span>{!n.readAt && <span className="badge bg-primary text-white">Mới</span>}<span className="ml-auto text-xs text-slate-400">{n.createdAt.toLocaleString("vi-VN")}</span></div>
              {n.body && <div className="text-sm text-slate-500 mt-1">{n.body}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
