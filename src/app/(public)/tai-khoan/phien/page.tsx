import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { redirect } from "next/navigation";
import { PageTitle, DataTable, StatusBadge } from "@/components/ui";
import RevokeButtons from "./revoke-buttons";

export default async function SessionsPage() {
  const s = await getSession().catch(() => null);
  if (!s) redirect("/dang-nhap");
  const sessions = await prisma.session.findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <div>
      <PageTitle title="Phiên đăng nhập" sub="Xem và thu hồi các phiên đang hoạt động (ACC-07). Thu hồi phiên khác nếu nghi ngờ bị lộ tài khoản." action={<RevokeButtons />} />
      <DataTable cols={["Thiết bị / IP", "Bắt đầu", "Hết hạn", "Trạng thái", ""]} rows={sessions.map((x) => [
        <span key="a" className="text-xs">{x.ip ?? "—"}<br /><span className="text-slate-400">{(x.userAgent ?? "").slice(0, 60)}</span></span>,
        x.createdAt.toLocaleString("vi-VN"),
        x.expiresAt.toLocaleString("vi-VN"),
        x.revokedAt ? <StatusBadge key="s" status="CANCELLED" /> : x.expiresAt < new Date() ? <StatusBadge key="s" status="EXPIRED" /> : <span key="s" className="badge bg-green-100 text-green-700">{x.id === s.sid ? "Phiên hiện tại" : "Đang hoạt động"}</span>,
        x.id === s.sid ? "—" : <RevokeButtons key="b" sessionId={x.id} />,
      ])} />
    </div>
  );
}
