import "./globals.css";
import Link from "next/link";
import { getSession } from "@/modules/security";

export const metadata = { title: "SunCard — Nền tảng phân phối sản phẩm số", description: "Nạp game, mua thẻ, gạch thẻ, mạng lưới đại lý." };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  return (
    <html lang="vi">
      <body>
        <header className="bg-navy text-white sticky top-0 z-40">
          <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-6">
            <Link href="/" className="font-bold text-lg tracking-tight">Sun<span className="text-blue-400">Card</span></Link>
            <nav className="hidden md:flex gap-5 text-sm text-slate-200">
              <Link href="/" className="hover:text-white">Đổi thẻ</Link>
              <Link href="/nap-game" className="hover:text-white">Nạp game</Link>
              <Link href="/cua-hang-the" className="hover:text-white">Mua thẻ</Link>
              <Link href="/dai-ly" className="hover:text-white">Đại lý</Link>
              <Link href="/tai-lieu" className="hover:text-white">Tài liệu</Link>
              <Link href="/tro-giup" className="hover:text-white">Hỗ trợ</Link>
            </nav>
            <details className="md:hidden relative">
              <summary className="list-none cursor-pointer p-2 -m-1 [&::-webkit-details-marker]:hidden" aria-label="Mở menu">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
              </summary>
              <nav className="absolute left-0 top-10 w-52 bg-white text-navy rounded-xl shadow-lg border p-2 text-sm z-50">
                <Link href="/" className="block px-3 py-2 rounded-lg hover:bg-slate-100 font-medium">Đổi thẻ (trang chính)</Link>
                <Link href="/nap-game" className="block px-3 py-2 rounded-lg hover:bg-slate-100">Nạp game</Link>
                <Link href="/cua-hang-the" className="block px-3 py-2 rounded-lg hover:bg-slate-100">Mua thẻ</Link>
                <Link href="/dai-ly" className="block px-3 py-2 rounded-lg hover:bg-slate-100">Đại lý</Link>
                <Link href="/tai-lieu" className="block px-3 py-2 rounded-lg hover:bg-slate-100">Tài liệu</Link>
                <Link href="/tro-giup" className="block px-3 py-2 rounded-lg hover:bg-slate-100">Hỗ trợ</Link>
                {session && <Link href="/tai-khoan" className="block px-3 py-2 rounded-lg hover:bg-slate-100">Tài khoản của tôi</Link>}
              </nav>
            </details>
            <div className="ml-auto flex gap-3 text-sm">
              {session ? (<>
                <Link href="/tai-khoan" className="hover:text-white">{session.email}</Link>
                {session.roles.some(r => ["SUPER_ADMIN","ADMIN","OPS","FINANCE","SUPPORT"].includes(r)) && <Link href="/admin" className="hover:text-white">Admin</Link>}
                <form action="/api/auth/logout" method="post"><button className="text-slate-300 hover:text-white">Đăng xuất</button></form>
              </>) : (<>
                <Link href="/dang-nhap" className="hover:text-white">Đăng nhập</Link>
                <Link href="/dang-ky" className="bg-primary rounded-lg px-3 py-1.5 hover:bg-blue-700">Đăng ký</Link>
              </>)}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 min-h-[70vh]">{children}</main>
        <footer className="bg-navy text-slate-300 mt-10">
          <div className="mx-auto max-w-7xl px-4 py-8 grid md:grid-cols-3 gap-6 text-sm">
            <div><div className="font-bold text-white mb-2">SunCard</div><p>Nền tảng phân phối sản phẩm số đa nhà cung cấp: nạp game, thẻ cào, gift card và mạng lưới đại lý nhiều tầng.</p></div>
            <div><div className="font-bold text-white mb-2">Sản phẩm</div><Link className="block py-0.5" href="/nap-game">Nạp game</Link><Link className="block py-0.5" href="/cua-hang-the">Cửa hàng thẻ</Link><Link className="block py-0.5" href="/">Đổi thẻ</Link></div>
            <div><div className="font-bold text-white mb-2">Hỗ trợ</div><Link className="block py-0.5" href="/tro-giup">Trung tâm hỗ trợ</Link><Link className="block py-0.5" href="/tai-lieu">Tài liệu API</Link><Link className="block py-0.5" href="/dieu-khoan">Điều khoản</Link><Link className="block py-0.5" href="/bao-mat">Chính sách bảo mật</Link></div>
          </div>
        </footer>
      </body>
    </html>
  );
}
