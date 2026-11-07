import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/modules/security";
import { prisma } from "@/lib/prisma";
import { SideNav, type SideGroup } from "@/components/nav";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const [profile, avail] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: session.userId } }).catch(() => null),
    prisma.ledgerAccount.findUnique({ where: { code: `WALLET:${session.userId}:AVAILABLE` } }).catch(() => null),
  ]);
  const displayName = profile?.fullName ?? session.email.split("@")[0];
  const initial = (displayName.trim().charAt(0) || "S").toUpperCase();
  const balance = `${Number(avail?.balanceMinor ?? BigInt(0)).toLocaleString("vi-VN")}₫`;

  const groups: SideGroup[] = [
    {
      label: "Hoạt động",
      items: [
        { href: "/tai-khoan", label: "Tổng quan", icon: "grid" },
        { href: "/tai-khoan/don-hang", label: "Đơn hàng", icon: "receipt" },
        { href: "/tra-cuu", label: "Lịch sử đổi thẻ", icon: "clock" },
        { href: "/tai-khoan/the-da-mua", label: "Thẻ đã mua", icon: "card" },
      ],
    },
    { label: "Ví & tiền", items: [{ href: "/tai-khoan/vi", label: "Ví của tôi", icon: "wallet" }] },
    {
      label: "Tài khoản",
      items: [
        { href: "/tai-khoan/ho-tro", label: "Hỗ trợ", icon: "headset" },
        { href: "/tai-khoan/api-keys", label: "Kết nối API", icon: "key" },
        { href: "/tai-khoan/mfa", label: "Bảo mật 2 lớp (MFA)", icon: "shield" },
        { href: "/tai-khoan/phien", label: "Phiên đăng nhập", icon: "sessions" },
      ],
    },
  ];

  const avatar = (
    <span className="w-[42px] h-[42px] rounded-full flex-none flex items-center justify-center text-white font-extrabold text-[17px]" style={{ background: "linear-gradient(135deg,#14213D,#33507E)" }}>{initial}</span>
  );
  const profileDesktop = (
    <div className="flex items-center gap-3 px-2 pt-1.5 pb-3.5 border-b border-[#F7EDD8] mb-1.5">
      {avatar}
      <span className="min-w-0">
        <span className="block text-[13.5px] font-extrabold text-navy truncate">{session.email}</span>
        <span className="block text-xs font-semibold text-[#A08B62] mt-0.5">Số dư ví: <b className="text-navy">{balance}</b></span>
      </span>
    </div>
  );
  const profileMobile = (
    <div className="bg-white border-[1.5px] border-[#F3E5C8] rounded-[18px] p-3.5 flex items-center gap-3 shadow-[0_5px_16px_rgba(120,80,10,0.06)]">
      {avatar}
      <span className="min-w-0">
        <span className="block text-[13.5px] font-extrabold text-navy truncate">{session.email}</span>
        <span className="block text-xs font-semibold text-[#A08B62] mt-0.5">Số dư ví: <b className="text-sundeep">{balance}</b></span>
      </span>
      <Link href="/tai-khoan/vi" aria-label="Nạp tiền vào ví" className="ml-auto w-[34px] h-[34px] rounded-full bg-grad-sun text-white flex items-center justify-center shadow-sun shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </Link>
    </div>
  );

  return (
    <div className="md:flex md:gap-6 md:items-start">
      <SideNav profile={profileDesktop} mobileProfile={profileMobile} groups={groups} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
