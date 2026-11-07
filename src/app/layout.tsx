import "./globals.css";
import Link from "next/link";
import { getSession } from "@/modules/security";
import { prisma } from "@/lib/prisma";
import SiteHeader, { SunMark, type HeaderUser } from "@/components/SiteHeader";

export const metadata = { title: "SunCard — Đổi thẻ cào, nạp game, mua thẻ số", description: "Đổi thẻ cào lấy tiền ví, nạp game, mua thẻ — phí minh bạch, xử lý tự động 24/7." };

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "OPS", "FINANCE", "SUPPORT"];
const ROLE_LINE: Record<string, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Admin", OPS: "Vận hành", FINANCE: "Tài chính", SUPPORT: "Hỗ trợ", PRODUCT_MANAGER: "Sản phẩm", PROVIDER_MANAGER: "Nhà cung cấp", RISK: "Rủi ro", AUDITOR: "Kiểm toán" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  const isStaff = !!session?.roles.some((r) => STAFF_ROLES.includes(r));
  let headerUser: HeaderUser | null = null;
  if (session) {
    const [profile, avail, unread, notifRows] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId: session.userId } }).catch(() => null),
      prisma.ledgerAccount.findUnique({ where: { code: `WALLET:${session.userId}:AVAILABLE` } }).catch(() => null),
      prisma.notification.count({ where: { userId: session.userId, readAt: null } }).catch(() => 0),
      prisma.notification.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" }, take: 6 }).catch(() => []),
    ]);
    const displayName = profile?.fullName ?? session.email.split("@")[0];
    headerUser = {
      email: session.email,
      displayName,
      initial: (displayName.trim().charAt(0) || "S").toUpperCase(),
      roleLine: isStaff ? (ROLE_LINE[session.roles[0]] ?? session.roles[0]) : "Thành viên",
      isStaff,
      balance: `${Number(avail?.balanceMinor ?? BigInt(0)).toLocaleString("vi-VN")}₫`,
      unread,
      notifications: notifRows.map((n) => ({ id: n.id, title: n.title, body: n.body ?? "", time: n.createdAt.toISOString(), read: !!n.readAt })),
    };
  }
  return (
    <html lang="vi">
      <body>
        <SiteHeader user={headerUser} />
        <main className="mx-auto max-w-7xl px-4 py-6 min-h-[70vh] w-full">{children}</main>
        <footer className="bg-navy text-slate-300 mt-12">
          <div className="mx-auto max-w-7xl px-4 py-10 grid md:grid-cols-[2fr_1fr_1fr_1fr] gap-8 text-sm">
            <div>
              <div className="flex items-center gap-2.5 font-extrabold text-lg text-white mb-3"><SunMark size={30} /> SunCard</div>
              <p className="leading-relaxed text-slate-400">Nền tảng đổi thẻ cào, nạp game và mua thẻ số. Một ví cho mọi dịch vụ — minh bạch phí, xử lý tự động 24/7.</p>
            </div>
            <div><div className="font-bold text-white mb-3">Dịch vụ</div>
              <Link className="block py-1 hover:text-sun2" href="/">Đổi thẻ cào</Link>
              <Link className="block py-1 hover:text-sun2" href="/tra-cuu">Lịch sử đổi thẻ</Link>
              <Link className="block py-1 hover:text-sun2" href="/nap-game">Nạp game</Link>
              <Link className="block py-1 hover:text-sun2" href="/cua-hang-the">Mua thẻ</Link>
              <Link className="block py-1 hover:text-sun2" href="/dai-ly">Đại lý & API</Link></div>
            <div><div className="font-bold text-white mb-3">Hỗ trợ</div>
              <Link className="block py-1 hover:text-sun2" href="/tro-giup">Trung tâm hỗ trợ</Link>
              <Link className="block py-1 hover:text-sun2" href="/tai-lieu">Tài liệu API</Link>
              <Link className="block py-1 hover:text-sun2" href="/tai-khoan/ho-tro">Gửi yêu cầu hỗ trợ</Link></div>
            <div><div className="font-bold text-white mb-3">Pháp lý</div>
              <Link className="block py-1 hover:text-sun2" href="/dieu-khoan">Điều khoản</Link>
              <Link className="block py-1 hover:text-sun2" href="/bao-mat">Chính sách bảo mật</Link></div>
          </div>
          <div className="border-t border-white/10">
            <div className="mx-auto max-w-7xl px-4 py-4 text-[13px] text-slate-400 flex flex-wrap justify-between gap-2">
              <span>© 2026 SunCard. Mọi quyền được bảo lưu.</span><span>support@suncard.vn</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
