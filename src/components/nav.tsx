"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/* Bộ icon SVG dùng chung cho header + các menu (stroke, theo màu chữ của phần tử cha). */
export const ICON_PATHS: Record<string, ReactNode> = {
  grid: (<><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></>),
  receipt: (<><path d="M5 3h14v18l-2.3-1.6L14.4 21l-2.4-1.6L9.6 21l-2.3-1.6L5 21z" /><path d="M9 8h6M9 12h6" /></>),
  swap: (<><path d="M7 10l-4 4 4 4M3 14h13M17 6l4-4-4-4M21 2v6H9" /></>),
  card: (<><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10.5h18" /></>),
  bell: (<><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></>),
  wallet: (<><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" /><path d="M3 7v10a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z" /><circle cx="16.5" cy="14" r="1.2" fill="currentColor" stroke="none" /></>),
  headset: (<><path d="M4 13a8 8 0 0 1 16 0" /><rect x="2" y="13" width="4" height="7" rx="2" /><rect x="18" y="13" width="4" height="7" rx="2" /><path d="M20 19a3 3 0 0 1-3 3h-3" /></>),
  key: (<><circle cx="8" cy="14" r="4.5" /><path d="M11.2 10.8L20 2M16 6l3.5 3.5M13 9l2.5 2.5" /></>),
  shield: (<><path d="M12 3l7 3v5c0 5-3 8.2-7 10-4-1.8-7-5-7-10V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></>),
  sessions: (<><rect x="2.5" y="4" width="13" height="10" rx="2" /><path d="M8.5 20h7M19 21v-3.5M19 12.5V9" /><circle cx="19" cy="15" r="2.4" /></>),
  chart: (<><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /></>),
  download: (<><path d="M12 3v10M8 9l4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>),
  layers: (<><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>),
  box: (<><path d="M3 8l9-5 9 5v8l-9 5-9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>),
  tag: (<><path d="M3 3h8l10 10-8 8L3 11z" /><circle cx="8" cy="8" r="1.6" /></>),
  server: (<><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>),
  users: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.4 3.4-5 6.5-5s5.5 1.6 6.5 5" /><path d="M16 5.5a3.5 3.5 0 0 1 0 6.5M18 15.3c1.8.7 3 2 3.5 4.2" /></>),
  store: (<><path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-6h6v6" /></>),
  code: (<><path d="M8 6l-6 6 6 6M16 6l6 6-6 6" /></>),
  book: (<><path d="M5 3h14a1 1 0 0 1 1 1v17l-3.2-2-3.3 2-3.5-2.2L6.7 21 4 19V4a1 1 0 0 1 1-1z" /><path d="M8 8h8M8 12h5" /></>),
  trend: (<><path d="M3 17l5.5-5.5 3.5 3.5L20 7" /><path d="M14 7h6v6" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>),
  percent: (<><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2.6" /><circle cx="17" cy="17" r="2.6" /></>),
  reconcile: (<><path d="M8 3H5a2 2 0 0 0-2 2v3h5zM8 21H5a2 2 0 0 1-2-2v-3h5zM16 3h3a2 2 0 0 1 2 2v3h-5zM16 21h3a2 2 0 0 0 2-2v-3h-5z" /><path d="M9 12l2 2 4-4" /></>),
  flag: (<><path d="M5 21V4" /><path d="M5 4h13l-2.5 4L18 12H5" /></>),
  alert: (<><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5h.01" /></>),
  lock: (<><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>),
  list: (<><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></>),
  file: (<><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6" /></>),
  gear: (<><circle cx="12" cy="12" r="3.2" /><path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.36.95A7 7 0 0 0 14.1 5.1L13.7 2.6h-3.4l-.4 2.5a7 7 0 0 0-2.4 1.44l-2.36-.95-2 3.46 2 1.55a7 7 0 0 0 0 2.8l-2 1.55 2 3.46 2.36-.95a7 7 0 0 0 2.4 1.44l.4 2.5h3.4l.4-2.5a7 7 0 0 0 2.4-1.44l2.36.95 2-3.46-2-1.55c.1-.45.14-.92.14-1.4z" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>),
  gamepad: (<><path d="M6 9h4M8 7v4M15 10h.01M18 8h.01" /><path d="M7.5 5h9A5.5 5.5 0 0 1 22 10.5c0 2.4-1.9 4-4 4-1.2 0-2-.5-2.8-1.3L14 12h-4l-1.2 1.2C8 14 7.2 14.5 6 14.5c-2.1 0-4-1.6-4-4C2 7.5 4.5 5 7.5 5z" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-3.6 4.5-5 8-5s6.5 1.4 8 5" /></>),
  network: (<><circle cx="6" cy="6" r="2.6" /><circle cx="18" cy="6" r="2.6" /><circle cx="12" cy="18" r="2.6" /><path d="M8.3 7.3l2 7M15.7 7.3l-2 7M8.6 6h6.8" /></>),
};

export function NavIcon({ k, size = 16, sw = 2.1 }: { k: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[k] ?? ICON_PATHS.grid}
    </svg>
  );
}

export interface SideItem { href: string; label: string; icon: string; dot?: boolean }
export interface SideGroup { label?: string; items: SideItem[] }

const ROOTS = ["/tai-khoan", "/admin", "/dai-ly/portal"];
export function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (ROOTS.includes(href) || href === "/") return false;
  return pathname.startsWith(href + "/");
}

/** Menu bên (Tài khoản / Admin / Đại lý): desktop = thẻ sidebar có nhóm + icon; mobile = thẻ hồ sơ + hàng chip trượt ngang. */
export function SideNav({ profile, mobileProfile, groups }: { profile: ReactNode; mobileProfile?: ReactNode; groups: SideGroup[] }) {
  const pathname = usePathname();
  const flat = groups.flatMap((g) => g.items);
  return (
    <>
      {/* Mobile */}
      <div className="md:hidden mb-5">
        {mobileProfile ?? profile}
        <div className="relative mt-3">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {flat.map((it) => {
              const on = isActive(pathname, it.href);
              return (
                <Link key={it.href} href={it.href} className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-2 text-[13px] font-bold ${on ? "bg-grad-sun text-white border-transparent shadow-sun" : "bg-white border-sunline text-ink2"}`}>
                  <NavIcon k={it.icon} size={15} />
                  {it.label}
                  {it.dot && <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[#F04B3A] border border-white" />}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      {/* Desktop */}
      <aside className="hidden md:block w-[262px] shrink-0">
        <div className="sticky top-24 bg-white border-[1.5px] border-[#F3E5C8] rounded-[20px] p-3 shadow-[0_6px_20px_rgba(120,80,10,0.06)] max-h-[calc(100vh-120px)] overflow-y-auto">
          {profile}
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.label && <div className="text-[10.5px] font-extrabold tracking-[0.15em] uppercase text-[#B39B6B] px-2.5 pt-3.5 pb-1.5">{g.label}</div>}
              {g.items.map((it) => {
                const on = isActive(pathname, it.href);
                return (
                  <Link key={it.href} href={it.href} className={`flex items-center gap-2.5 rounded-[13px] px-2.5 py-[9px] text-sm ${on ? "bg-grad-sun text-white font-bold shadow-sun" : "font-semibold text-ink2 hover:bg-[#FFFBF2]"}`}>
                    <span className={`w-[31px] h-[31px] rounded-[10px] flex items-center justify-center shrink-0 ${on ? "bg-white/20 text-white" : "bg-[#FFF3DF] text-sundeep"}`}>
                      <NavIcon k={it.icon} size={16} />
                    </span>
                    <span className="truncate">{it.label}</span>
                    {it.dot && <span className="ml-auto w-2 h-2 rounded-full bg-[#F04B3A] shrink-0" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
