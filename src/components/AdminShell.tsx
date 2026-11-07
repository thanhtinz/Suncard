"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NavIcon, isActive, type SideGroup } from "./nav";
import { SunMark } from "./SiteHeader";

// ============================================================================
// Admin theme riêng cho khu /admin: sidebar navy cố định + topbar riêng +
// footer riêng — tách hẳn khỏi header/footer của web bán hàng.
// ============================================================================

export interface AdminShellUser {
  email: string;
  displayName: string;
  initial: string;
  roleLine: string;
}

function NavList({ groups, pathname, onNavigate }: { groups: SideGroup[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav>
      {groups.map((g, gi) => (
        <div key={gi} className={gi === 0 ? "" : "mt-5"}>
          {g.label && <div className="px-3 text-[10.5px] font-extrabold tracking-[0.14em] uppercase text-white/35">{g.label}</div>}
          <ul className="mt-1.5 space-y-0.5">
            {g.items.map((it) => {
              const active = isActive(pathname, it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    className={active
                      ? "flex items-center gap-2.5 rounded-xl bg-grad-sun px-3 py-2 text-[13.5px] font-bold text-white shadow-sun"
                      : "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-white/65 hover:bg-white/10 hover:text-white"}
                  >
                    <NavIcon k={it.icon} size={17} />
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.dot && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-label="Có mục chờ xử lý" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarBody({ user, groups, pathname, onNavigate }: { user: AdminShellUser; groups: SideGroup[]; pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/10">
        <SunMark size={40} />
        <span className="min-w-0">
          <span className="block text-[17px] font-extrabold leading-5 text-white">Sun<span className="text-grad-sun">Card</span></span>
          <span className="mt-0.5 inline-block rounded-full bg-white/10 px-2 py-[2px] text-[10px] font-extrabold tracking-[0.12em] text-amber-300">ADMIN PANEL</span>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavList groups={groups} pathname={pathname} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-extrabold text-white">{user.initial}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-bold text-white">{user.displayName}</span>
            <span className="block truncate text-xs text-white/50">{user.roleLine} · {user.email}</span>
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <Link href="/" className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-center text-[13px] font-semibold text-white/85 hover:bg-white/15">Xem website</Link>
          <form action="/api/auth/logout" method="post" className="flex-1">
            <button className="w-full rounded-xl bg-white/10 px-3 py-2 text-[13px] font-semibold text-white/85 hover:bg-white/15">Đăng xuất</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AdminShell({ user, groups, children }: { user: AdminShellUser; groups: SideGroup[]; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const [open, setOpen] = useState(false);
  const current = groups.flatMap((g) => g.items).find((it) => isActive(pathname, it.href));
  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 bg-navy lg:block">
        <SidebarBody user={user} groups={groups} pathname={pathname} />
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Đóng menu" className="absolute inset-0 bg-navy/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] bg-navy shadow-2xl">
            <button aria-label="Đóng menu" onClick={() => setOpen(false)} className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
            <SidebarBody user={user} groups={groups} pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar riêng của admin */}
        <header className="sticky top-0 z-30 border-b border-[#EFE3CB] bg-[#FFF9F1]/92 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#F0E2C4] bg-white text-navy lg:hidden" aria-label="Mở menu quản trị" onClick={() => setOpen(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <span className="flex items-center gap-2.5 lg:hidden">
              <SunMark size={30} />
              <span className="text-[15px] font-extrabold text-navy">SunCard <span className="text-sundeep">Admin</span></span>
            </span>
            <div className="hidden min-w-0 lg:block">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Quản trị SunCard</div>
              <div className="truncate text-[15px] font-extrabold leading-5 text-navy">{current?.label ?? "Tổng quan"}</div>
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <span className="hidden rounded-full bg-[#FFEEDA] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-sundeep sm:inline-block">{user.roleLine}</span>
              <Link href="/" className="btn-ghost hidden !px-3.5 !py-2 text-[13px] sm:inline-flex">Xem website</Link>
              <span className="hidden items-center gap-2.5 md:flex">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-[13px] font-extrabold text-white">{user.initial}</span>
                <span className="hidden min-w-0 xl:block">
                  <span className="block max-w-[180px] truncate text-[13px] font-bold leading-4 text-navy">{user.displayName}</span>
                  <span className="block max-w-[180px] truncate text-xs leading-4 text-slate-400">{user.email}</span>
                </span>
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>

        {/* Footer riêng của admin */}
        <footer className="border-t border-[#EFE3CB]">
          <div className="mx-auto flex w-full max-w-[1440px] flex-wrap justify-between gap-2 px-4 py-4 text-xs text-slate-400 sm:px-6 lg:px-8">
            <span>© 2026 SunCard — Trang quản trị nội bộ</span>
            <span>Chỉ dành cho nhân sự được cấp quyền truy cập</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
