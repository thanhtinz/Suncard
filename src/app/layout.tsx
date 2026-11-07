import "./globals.css";
import Link from "next/link";
import { getSession } from "@/modules/security";

export const metadata = { title: "SunCard — Đổi thẻ cào, nạp game, mua thẻ số", description: "Đổi thẻ cào lấy tiền ví, nạp game, mua thẻ — phí minh bạch, xử lý tự động 24/7." };

function SunMark({ size = 34 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-grad-sun shadow-sun shrink-0" style={{ width: size, height: size }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="#fff" /><g stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" /></g></svg>
    </span>
  );
}

const NAV = [
  { href: "/", label: "Đổi thẻ" },
  { href: "/tra-cuu", label: "Tra cứu" },
  { href: "/nap-game", label: "Nạp game" },
  { href: "/cua-hang-the", label: "Mua thẻ" },
  { href: "/dai-ly", label: "Đại lý" },
  { href: "/tai-lieu", label: "Tài liệu" },
  { href: "/tro-giup", label: "Hỗ trợ" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  const isStaff = session?.roles.some((r) => ["SUPER_ADMIN", "ADMIN", "OPS", "FINANCE", "SUPPORT"].includes(r));
  return (
    <html lang="vi">
      <body>
        <header className="sticky top-0 z-40 border-b border-sunline" style={{ background: "rgba(255,249,241,.92)", backdropFilter: "blur(8px)" }}>
          <div className="mx-auto max-w-7xl px-4 h-16 flex items-center gap-2.5 sm:gap-5">
            <Link href="/" className="flex items-center gap-2 sm:gap-2.5 font-extrabold text-lg sm:text-xl text-navy tracking-tight">
              <SunMark /> SunCard
            </Link>
            <nav className="hidden md:flex gap-5 text-[15px] font-semibold text-ink2 ml-2">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-sundeep py-1">{n.label}</Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2 sm:gap-2.5 text-sm">
              {session ? (<>
                <Link href="/tai-khoan" className="hidden sm:block font-semibold text-navy hover:text-sundeep max-w-[180px] truncate">{session.email}</Link>
                {isStaff && <Link href="/admin" className="font-semibold text-navy hover:text-sundeep">Admin</Link>}
                <form action="/api/auth/logout" method="post"><button className="btn-ghost !py-1.5">Đăng xuất</button></form>
              </>) : (<>
                <Link href="/dang-nhap" className="btn-ghost !py-2 !px-2.5 sm:!px-4 whitespace-nowrap text-[13px] sm:text-sm">Đăng nhập</Link>
                <Link href="/dang-ky" className="btn-primary !py-2 !px-2.5 sm:!px-4 whitespace-nowrap text-[13px] sm:text-sm">Đăng ký</Link>
              </>)}
            </div>
            <details className="md:hidden relative shrink-0">
              <summary className="list-none cursor-pointer p-2 -m-1 text-navy [&::-webkit-details-marker]:hidden" aria-label="Mở menu">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
              </summary>
              <nav className="absolute right-0 top-10 w-56 bg-white text-navy rounded-2xl shadow-sunsoft border border-sunline p-2 text-sm z-50">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="block px-3 py-2 rounded-lg hover:bg-orange-50">{n.label}</Link>
                ))}
                {session && <Link href="/tai-khoan" className="block px-3 py-2 rounded-lg hover:bg-orange-50 font-medium">Tài khoản của tôi</Link>}
                {!session && (<>
                  <Link href="/dang-nhap" className="block px-3 py-2 rounded-lg hover:bg-orange-50 font-medium border-t border-sunline mt-1 pt-3">Đăng nhập</Link>
                  <Link href="/dang-ky" className="block px-3 py-2 rounded-lg hover:bg-orange-50 font-medium">Đăng ký</Link>
                </>)}
              </nav>
            </details>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 min-h-[70vh] w-full">{children}</main>
        <footer className="bg-navy text-slate-300 mt-12">
          <div className="mx-auto max-w-7xl px-4 py-10 grid md:grid-cols-[2fr_1fr_1fr_1fr] gap-8 text-sm">
            <div>
              <div className="flex items-center gap-2.5 font-extrabold text-lg text-white mb-3"><SunMark size={30} /> SunCard</div>
              <p className="leading-relaxed text-slate-400">Nền tảng đổi thẻ cào, nạp game và mua thẻ số. Một ví cho mọi dịch vụ — minh bạch phí, xử lý tự động 24/7.</p>
            </div>
            <div><div className="font-bold text-white mb-3">Dịch vụ</div>
              <Link className="block py-1 hover:text-sun2" href="/">Đổi thẻ cào</Link>
              <Link className="block py-1 hover:text-sun2" href="/tra-cuu">Tra cứu đơn</Link>
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
