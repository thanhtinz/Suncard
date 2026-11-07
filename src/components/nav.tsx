"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/* Bộ icon dùng chung cho header + các menu: Font Awesome CSS (nạp ở layout),
   màu theo màu chữ của phần tử cha, cỡ theo font-size. */
export const FA_ICONS: Record<string, string> = {
  grid: "fa-table-cells-large",
  receipt: "fa-receipt",
  swap: "fa-arrow-right-arrow-left",
  card: "fa-credit-card",
  bell: "fa-bell",
  wallet: "fa-wallet",
  headset: "fa-headset",
  key: "fa-key",
  shield: "fa-shield-halved",
  sessions: "fa-desktop",
  chart: "fa-chart-column",
  download: "fa-download",
  layers: "fa-layer-group",
  box: "fa-box",
  tag: "fa-tag",
  server: "fa-server",
  users: "fa-users",
  store: "fa-store",
  code: "fa-code",
  book: "fa-book",
  trend: "fa-arrow-trend-up",
  clock: "fa-clock",
  percent: "fa-percent",
  reconcile: "fa-scale-balanced",
  flag: "fa-flag",
  alert: "fa-triangle-exclamation",
  lock: "fa-lock",
  list: "fa-list",
  file: "fa-file-lines",
  gear: "fa-gear",
  search: "fa-magnifying-glass",
  gamepad: "fa-gamepad",
  user: "fa-user",
  network: "fa-diagram-project",
  robot: "fa-robot",
  mail: "fa-envelope",
  trash: "fa-trash-can",
};

export function NavIcon({ k, size = 16 }: { k: string; size?: number; sw?: number }) {
  return <i className={`fa-solid ${FA_ICONS[k] ?? FA_ICONS.grid}`} style={{ fontSize: size }} aria-hidden="true" />;
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
