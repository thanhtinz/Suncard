import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { NavLink } from "@/components/ui";

export default async function AgentPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const agent = await prisma.agent.findUnique({ where: { userId: session.userId } });
  if (!agent) redirect("/dai-ly");
  const level = await prisma.agentLevel.findUnique({ where: { id: agent.levelId } });
  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-6 items-start">
      <aside className="card p-3 md:sticky md:top-20">
        <div className="px-3 py-2">
          <div className="font-semibold text-sm">Đại lý {agent.code}</div>
          <div className="text-xs text-slate-500">{level?.name ?? ""} · {agent.status}</div>
        </div>
        <NavLink href="/dai-ly/portal">Tổng quan</NavLink>
        <NavLink href="/dai-ly/portal/mang-luoi">Mạng lưới</NavLink>
        <NavLink href="/dai-ly/portal/bang-gia">Bảng giá</NavLink>
        <NavLink href="/dai-ly/portal/don-hang">Đơn hàng</NavLink>
        <NavLink href="/dai-ly/portal/hoa-hong">Hoa hồng</NavLink>
        <NavLink href="/dai-ly/portal/bao-cao">Báo cáo</NavLink>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
