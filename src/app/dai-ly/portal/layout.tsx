import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { SideNav, type SideGroup } from "@/components/nav";

export default async function AgentPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const agent = await prisma.agent.findUnique({ where: { userId: session.userId } });
  if (!agent) redirect("/dai-ly");
  const level = await prisma.agentLevel.findUnique({ where: { id: agent.levelId } });

  const groups: SideGroup[] = [
    {
      items: [
        { href: "/dai-ly/portal", label: "Tổng quan", icon: "grid" },
        { href: "/dai-ly/portal/mang-luoi", label: "Mạng lưới", icon: "network" },
        { href: "/dai-ly/portal/bang-gia", label: "Bảng giá", icon: "tag" },
        { href: "/dai-ly/portal/don-hang", label: "Đơn hàng", icon: "receipt" },
        { href: "/dai-ly/portal/hoa-hong", label: "Hoa hồng", icon: "percent" },
        { href: "/dai-ly/portal/bao-cao", label: "Báo cáo", icon: "chart" },
      ],
    },
  ];
  const initial = (agent.code.trim().charAt(0) || "Đ").toUpperCase();
  const avatar = (
    <span className="w-[42px] h-[42px] rounded-full flex-none flex items-center justify-center text-white font-extrabold text-[17px]" style={{ background: "linear-gradient(135deg,#14213D,#33507E)" }}>{initial}</span>
  );
  const profileDesktop = (
    <div className="flex items-center gap-3 px-2 pt-1.5 pb-3.5 border-b border-[#F7EDD8] mb-1.5">
      {avatar}
      <span className="min-w-0">
        <span className="block text-[13.5px] font-extrabold text-navy truncate">Đại lý {agent.code}</span>
        <span className="block text-xs font-semibold text-[#A08B62] mt-0.5">{level?.name ?? ""} · {agent.status}</span>
      </span>
    </div>
  );
  const profileMobile = (
    <div className="bg-white border-[1.5px] border-[#F3E5C8] rounded-[18px] p-3.5 flex items-center gap-3 shadow-[0_5px_16px_rgba(120,80,10,0.06)]">
      {avatar}
      <span className="min-w-0">
        <span className="block text-[13.5px] font-extrabold text-navy truncate">Đại lý {agent.code}</span>
        <span className="block text-xs font-semibold text-[#A08B62] mt-0.5">{level?.name ?? ""} · {agent.status}</span>
      </span>
    </div>
  );
  return (
    <div className="md:flex md:gap-6 md:items-start">
      <SideNav profile={profileDesktop} mobileProfile={profileMobile} groups={groups} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
