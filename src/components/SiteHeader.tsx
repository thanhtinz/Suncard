"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NavIcon, isActive } from "./nav";

export interface HeaderUser {
  email: string;
  displayName: string;
  initial: string;
  roleLine: string;
  isStaff: boolean;
  balance: string;
  unread: number;
}

export function SunMark({ size = 34 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-grad-sun shadow-sun shrink-0" style={{ width: size, height: size }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="#fff" /><g stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" /></g></svg>
    </span>
  );
}

const NAV = [
  { href: "/", label: "Đổi thẻ", icon: "swap" },
  { href: "/tra-cuu", label: "Tra cứu", icon: "search" },
  { href: "/nap-game", label: "Nạp game", icon: "gamepad" },
  { href: "/cua-hang-the", label: "Mua thẻ", icon: "card" },
  { href: "/dai-ly", label: "Đại lý", icon: "store" },
  { href: "/tai-lieu", label: "Tài liệu", icon: "file" },
  { href: "/tro-giup", label: "Hỗ trợ", icon: "headset" },
];

const TILES = [
  { href: "/", label: "Đổi thẻ", icon: "swap" },
  { href: "/nap-game", label: "Nạp game", icon: "gamepad" },
  { href: "/cua-hang-the", label: "Mua thẻ", icon: "card" },
  { href: "/tra-cuu", label: "Tra cứu", icon: "search" },
];

const ROWS = [
  { href: "/dai-ly", label: "Đại lý & đối tác", desc: "Chính sách hoa hồng, đăng ký mở đại lý", icon: "store" },
  { href: "/tai-lieu", label: "Tài liệu API", desc: "Tích hợp đổi thẻ & nạp game tự động", icon: "file" },
  { href: "/tro-giup", label: "Trung tâm hỗ trợ", desc: "Giải đáp & gửi yêu cầu 24/7", icon: "headset" },
];

export default function SiteHeader({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { if (window.location.hash === "#menu") setOpen(true); }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-[#F1DFC0] shadow-[0_6px_22px_rgba(232,106,23,0.08)]" style={{ background: "linear-gradient(180deg, rgba(255,252,246,.97), rgba(255,244,224,.97))", backdropFilter: "blur(8px)" }}>
      <div className="mx-auto max-w-7xl px-4 h-16 xl:h-[78px] flex items-center gap-2.5 sm:gap-4 relative">
        <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0" aria-label="SunCard — trang chủ">
          <span className="w-9 h-9 xl:w-[44px] xl:h-[44px] rounded-xl xl:rounded-[14px] bg-grad-sun shadow-sun flex items-center justify-center">
            <svg className="w-5 h-5 xl:w-[26px] xl:h-[26px]" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="#fff" /><g stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" /></g></svg>
          </span>
          <span className="text-lg sm:text-xl xl:text-[23px] font-extrabold tracking-tight text-navy">Sun<span className="text-grad-sun">Card</span></span>
        </Link>

        <nav className="hidden xl:flex items-center gap-0.5 mx-auto bg-white border border-[#F1E0C2] rounded-full p-[5px] shadow-[0_3px_12px_rgba(120,80,10,0.07)]" aria-label="Menu chính">
          {NAV.map((n) => {
            const on = isActive(pathname, n.href);
            return (
              <Link key={n.href} href={n.href} className={`flex items-center gap-1.5 px-[11px] py-2 rounded-full text-[13px] font-semibold whitespace-nowrap ${on ? "bg-grad-sun text-white shadow-sun" : "text-ink2 hover:bg-[#FFF3E0] hover:text-sundeep"}`}>
                <NavIcon k={n.icon} size={15} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
          {user ? (<>
            {!user.isStaff && (
            <span className="hidden md:flex items-center gap-2.5 bg-white border-[1.5px] border-[#F1E0C2] rounded-full py-1.5 pl-3.5 pr-1.5">
              <span className="text-sundeep"><NavIcon k="wallet" size={19} /></span>
              <span className="leading-none">
                <span className="block text-[10px] font-bold tracking-[0.08em] uppercase text-[#A08B62] mb-[3px] whitespace-nowrap">Số dư ví</span>
                <span className="block text-sm font-extrabold text-navy whitespace-nowrap">{user.balance}</span>
              </span>
              <Link href="/tai-khoan/vi" aria-label="Nạp tiền vào ví" className="w-[30px] h-[30px] rounded-full bg-grad-sun text-white flex items-center justify-center shadow-sun">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </Link>
            </span>
            )}
            <Link href="/tai-khoan/thong-bao" aria-label="Thông báo" className="relative hidden sm:flex w-[42px] h-[42px] rounded-full bg-white border-[1.5px] border-[#F1E0C2] items-center justify-center text-ink2 hover:text-sundeep">
              <NavIcon k="bell" size={19} />
              {user.unread > 0 && <span className="absolute top-[9px] right-[10px] w-2 h-2 rounded-full bg-[#F04B3A] border-2 border-white" />}
            </Link>
            {user.isStaff && (
              <Link href="/admin" className="hidden md:block text-sm font-semibold text-navy hover:text-sundeep">Admin</Link>
            )}
            <Link href="/tai-khoan" className="flex items-center gap-2.5 bg-white border-[1.5px] border-[#F1E0C2] rounded-full py-[5px] pl-[5px] pr-[5px] lg:pr-3.5 hover:border-[#FFB03A]">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-extrabold text-sm" style={{ background: "linear-gradient(135deg,#14213D,#33507E)" }}>{user.initial}</span>
              <span className="hidden lg:block leading-tight">
                <span className="block text-[13.5px] font-bold text-navy whitespace-nowrap max-w-[150px] truncate">{user.displayName}</span>
                <span className="block text-[11px] font-semibold text-[#A08B62]">{user.roleLine}</span>
              </span>
            </Link>
            <form action="/api/auth/logout" method="post" className="hidden md:block">
              <button className="btn-ghost !py-1.5 !px-3 text-[13px]" aria-label="Đăng xuất">Đăng xuất</button>
            </form>
          </>) : (<>
            <Link href="/dang-nhap" className="flex items-center gap-1.5 bg-white border-[1.5px] border-[#EFDCB8] rounded-full px-3 sm:px-4 py-2 sm:py-2.5 text-[13px] sm:text-sm font-bold text-navy whitespace-nowrap hover:border-[#FFB03A]">
              <span className="hidden sm:inline-flex"><NavIcon k="user" size={16} /></span>
              Đăng nhập
            </Link>
            <Link href="/dang-ky" className="flex items-center gap-1.5 bg-grad-sun rounded-full px-3 sm:px-[18px] py-2 sm:py-2.5 text-[13px] sm:text-sm font-extrabold text-white whitespace-nowrap shadow-sun">
              Đăng ký
              <svg className="hidden sm:block" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          </>)}
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? "Đóng menu" : "Mở menu"} aria-expanded={open}
            className={`xl:hidden w-[39px] h-[39px] rounded-xl border-[1.5px] flex items-center justify-center shrink-0 ${open ? "bg-navy border-navy text-white" : "bg-white border-[#F1E0C2] text-navy"}`}>
            {open
              ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h10" /></svg>}
          </button>
        </div>

        {open && (
          <div className="xl:hidden absolute inset-x-0 top-full px-3 sm:px-4 pb-3">
            <div className="bg-white rounded-[24px] border border-[#F1E0C2] shadow-[0_24px_34px_rgba(90,60,5,0.14)] p-4 max-h-[76vh] overflow-y-auto">
              {user && (
                <div className="flex items-center gap-3 pb-3.5 mb-3.5 border-b border-[#F7EDD8]">
                  <span className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-white font-extrabold" style={{ background: "linear-gradient(135deg,#14213D,#33507E)" }}>{user.initial}</span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-extrabold text-navy truncate">{user.email}</span>
                    <span className="block text-xs font-semibold text-[#A08B62] mt-0.5">Số dư ví: <b className="text-sundeep">{user.balance}</b></span>
                  </span>
                  <Link href="/tai-khoan/vi" aria-label="Nạp tiền vào ví" className="ml-auto w-[34px] h-[34px] rounded-full bg-grad-sun text-white flex items-center justify-center shadow-sun shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </Link>
                </div>
              )}
              <div className="text-[11px] font-extrabold tracking-[0.15em] uppercase text-[#B39B6B] px-0.5 mb-2.5">Dịch vụ</div>
              <div className="grid grid-cols-4 gap-2">
                {TILES.map((n) => {
                  const on = isActive(pathname, n.href);
                  return (
                    <Link key={n.href} href={n.href} className={`rounded-2xl border-[1.5px] px-1 py-2.5 text-center ${on ? "border-[#FFB03A] bg-[#FFF5E4]" : "border-[#F5E7CB] bg-[#FFF9F1]"}`}>
                      <span className={`w-[38px] h-[38px] mx-auto mb-1.5 rounded-xl flex items-center justify-center ${on ? "bg-grad-sun text-white shadow-sun" : "bg-[#FFE9CF] text-sundeep"}`}>
                        <NavIcon k={n.icon} size={19} />
                      </span>
                      <span className="block text-xs font-bold text-navy">{n.label}</span>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-1.5">
                {ROWS.map((r) => (
                  <Link key={r.href + r.label} href={r.href} className="flex items-center gap-3 py-3 border-t border-[#F7EDD8]">
                    <span className="w-[34px] h-[34px] rounded-[11px] bg-[#FFF3DF] text-sundeep flex items-center justify-center shrink-0"><NavIcon k={r.icon} size={17} /></span>
                    <span>
                      <span className="block text-sm font-bold text-navy">{r.label}</span>
                      <span className="block text-xs font-medium text-[#A08B62] mt-0.5">{r.desc}</span>
                    </span>
                    <svg className="ml-auto shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9B48A" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
                  </Link>
                ))}
                {user && (<>
                  <Link href="/tai-khoan" className="flex items-center gap-3 py-3 border-t border-[#F7EDD8]">
                    <span className="w-[34px] h-[34px] rounded-[11px] bg-[#FFF3DF] text-sundeep flex items-center justify-center shrink-0"><NavIcon k="user" size={17} /></span>
                    <span className="text-sm font-bold text-navy">Tài khoản của tôi</span>
                    <svg className="ml-auto shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9B48A" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
                  </Link>
                  <Link href="/tai-khoan/thong-bao" className="flex items-center gap-3 py-3 border-t border-[#F7EDD8]">
                    <span className="relative w-[34px] h-[34px] rounded-[11px] bg-[#FFF3DF] text-sundeep flex items-center justify-center shrink-0">
                      <NavIcon k="bell" size={17} />
                      {user.unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F04B3A]" />}
                    </span>
                    <span className="text-sm font-bold text-navy">Thông báo</span>
                    <svg className="ml-auto shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9B48A" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
                  </Link>
                  <form action="/api/auth/logout" method="post" className="border-t border-[#F7EDD8]">
                    <button className="flex w-full items-center gap-3 py-3 text-left">
                      <span className="w-[34px] h-[34px] rounded-[11px] bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3M16 17l5-5-5-5M21 12H9" /></svg>
                      </span>
                      <span className="text-sm font-bold text-red-500">Đăng xuất</span>
                    </button>
                  </form>
                </>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
