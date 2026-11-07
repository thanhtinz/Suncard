"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { NavIcon, isActive, type SideGroup } from "./nav";

// ============================================================================
// Theme quản trị RIÊNG HOÀN TOÀN (không dùng header/footer/style của web bán
// hàng): sidebar trắng có nhóm thu gọn được, topbar trắng có ô tìm nhanh trong
// menu, nền xám nhạt, điểm nhấn đỏ admin. Bao trong .admin-scope để CSS ghi đè.
// ============================================================================

export interface AdminShellUser {
  email: string;
  displayName: string;
  initial: string;
  roleLine: string;
}

function groupHasActive(g: SideGroup, pathname: string) {
  return g.items.some((it) => isActive(pathname, it.href));
}

function NavList({ groups, pathname, query, onNavigate }: { groups: SideGroup[]; pathname: string; query: string; onNavigate?: () => void }) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => groups.map((g) => ({
    g,
    items: q ? g.items.filter((it) => it.label.toLowerCase().includes(q)) : g.items,
  })).filter((x) => x.items.length > 0), [groups, q]);

  return (
    <nav>
      {visible.map(({ g, items }, gi) => {
        const key = g.label ?? "__top";
        const hasActive = groupHasActive(g, pathname);
        const open = q ? true : (openGroups[key] ?? (gi === 0 || hasActive));
        const inner = (
          <ul className="space-y-0.5">
            {items.map((it) => {
              const active = isActive(pathname, it.href);
              return (
                <li key={it.href + it.label}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    className={active
                      ? "flex items-center gap-2.5 rounded-lg bg-[#FDECEA] px-3 py-2 text-[13.5px] font-bold text-[#D92D20]"
                      : "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"}
                  >
                    <span className={active ? "text-[#D92D20]" : "text-slate-400"}><NavIcon k={it.icon} size={16} /></span>
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.dot && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-label="Có mục chờ xử lý" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        );
        if (!g.label) return <div key={key} className="mb-2">{inner}</div>;
        return (
          <div key={key} className="mt-1.5">
            <button
              type="button"
              onClick={() => setOpenGroups((s) => ({ ...s, [key]: !open }))}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-800 hover:bg-slate-100"
              aria-expanded={open}
            >
              <span className="flex-1 text-left">{g.label}</span>
              <i className={`fa-solid fa-chevron-down text-[11px] text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {open && <div className="mt-0.5">{inner}</div>}
          </div>
        );
      })}
      {q && visible.length === 0 && <p className="px-3 py-2 text-[13px] text-slate-400">Không có mục nào khớp “{query}”.</p>}
    </nav>
  );
}

function SidebarBody({ user, groups, pathname, query, onNavigate }: { user: AdminShellUser; groups: SideGroup[]; pathname: string; query: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 pb-4 pt-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D92D20] text-white shadow-sm">
          <i className="fa-solid fa-sun text-[19px]" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[17px] font-extrabold leading-5 text-slate-900">SunCard</span>
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#D92D20]">Trang quản trị</span>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-2.5 py-3">
        <NavList groups={groups} pathname={pathname} query={query} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-slate-100 p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[13px] font-extrabold text-white">{user.initial}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold text-slate-800">{user.displayName}</span>
            <span className="block truncate text-[11.5px] text-slate-400">{user.roleLine} · {user.email}</span>
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <Link href="/" className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-center text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50">Xem website</Link>
          <form action="/api/auth/logout" method="post" className="flex-1">
            <button className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50">Đăng xuất</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AdminShell({ user, groups, alertCount = 0, children }: { user: AdminShellUser; groups: SideGroup[]; alertCount?: number; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = groups.flatMap((g) => g.items).find((it) => isActive(pathname, it.href));
  return (
    <div className="admin-scope min-h-screen lg:flex">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 border-r border-slate-200 lg:block">
        <SidebarBody user={user} groups={groups} pathname={pathname} query={query} />
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Đóng menu" className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] shadow-2xl">
            <button aria-label="Đóng menu" onClick={() => setOpen(false)} className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <i className="fa-solid fa-xmark text-[15px]" aria-hidden="true" />
            </button>
            <SidebarBody user={user} groups={groups} pathname={pathname} query={query} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar riêng của admin */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex w-full items-center gap-3 px-4 py-2.5 sm:px-6">
            <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 lg:hidden" aria-label="Mở menu quản trị" onClick={() => setOpen(true)}>
              <i className="fa-solid fa-bars text-[16px]" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-extrabold leading-5 text-slate-900">{current?.label ?? "Bảng quản trị"}</div>
              <div className="hidden text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 sm:block">Quản trị SunCard</div>
            </div>
            <div className="relative mx-auto hidden w-full max-w-sm md:block">
              <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm nhanh trong menu…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-[13px] outline-none focus:border-[#D92D20] focus:bg-white"
                aria-label="Tìm nhanh trong menu quản trị"
              />
            </div>
            <div className="ml-auto flex items-center gap-2.5 md:ml-0">
              <span className="hidden text-[13px] font-semibold text-slate-500 xl:block">Hệ thống đổi thẻ</span>
              <Link href="/admin/rui-ro" aria-label="Cảnh báo rủi ro" className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#D92D20]">
                <i className="fa-solid fa-bell text-[16px]" aria-hidden="true" />
                {alertCount > 0 && <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#D92D20] px-1 text-[10px] font-extrabold text-white">{alertCount}</span>}
              </Link>
              <span className="hidden items-center gap-2.5 sm:flex">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-[13px] font-extrabold text-white">{user.initial}</span>
                <span className="hidden min-w-0 xl:block">
                  <span className="block max-w-[180px] truncate text-[13px] font-bold leading-4 text-slate-800">{user.displayName}</span>
                  <span className="block max-w-[180px] truncate text-xs leading-4 text-slate-400">{user.email}</span>
                </span>
              </span>
            </div>
          </div>
          {/* Tìm nhanh trên mobile: lọc menu trong ngăn kéo */}
          <div className="border-t border-slate-100 px-4 py-2 md:hidden">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); if (e.target.value) setOpen(true); }}
                placeholder="Tìm nhanh trong menu…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-[13px] outline-none focus:border-[#D92D20] focus:bg-white"
                aria-label="Tìm nhanh trong menu quản trị"
              />
            </div>
          </div>
        </header>

        <main className="w-full flex-1 px-4 py-5 sm:px-6">{children}</main>

        <footer className="border-t border-slate-200 bg-white">
          <div className="flex w-full flex-wrap justify-between gap-2 px-4 py-3.5 text-xs text-slate-400 sm:px-6">
            <span>© 2026 SunCard — Trang quản trị nội bộ</span>
            <span>Chỉ dành cho nhân sự được cấp quyền truy cập</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
