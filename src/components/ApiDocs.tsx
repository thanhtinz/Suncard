import Link from "next/link";
import type { ReactNode } from "react";
import CodeTabs from "./CodeTabs";

export const SITE = "https://suncard-eight.vercel.app";
export { CodeTabs };

export const MODULES = [
  { key: "charging", href: "/tai-lieu/api/charging", title: "Đổi thẻ cào", desc: "API gửi thẻ, kiểm tra trạng thái và lấy biểu phí.", badge: "API CHARGING V2" },
  { key: "recharge", href: "/tai-lieu/api/recharge", title: "Nạp topup", desc: "API topup dịch vụ, tra cứu giao dịch, số dư, sản phẩm và biểu phí.", badge: "API RECHARGE" },
  { key: "softcard", href: "/tai-lieu/api/softcard", title: "Mua mã thẻ", desc: "API mua mã thẻ, tải lại đơn, kiểm tra tồn kho và lấy danh sách sản phẩm.", badge: "API SOFTCARD" },
  { key: "rest", href: "/tai-lieu/api/rest", title: "REST API v1 (HMAC)", desc: "API tổng hợp ký HMAC-SHA256: đơn hàng, ví, sản phẩm, webhook.", badge: "PARTNER API V1" },
];

export function ModuleCards({ active }: { active?: string }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {MODULES.map((m) => (
        <Link key={m.key} href={m.href} className={`block rounded-[18px] border p-4 transition ${active === m.key ? "bg-[#EAF1FF] border-[#B9CCF5] shadow-soft" : "bg-[#F4F7FE] border-[#E1E9F8] hover:border-[#B9CCF5]"}`}>
          <div className="font-bold text-navy">{m.title}</div>
          <p className="text-[13px] text-slate-500 mt-0.5 leading-5">{m.desc}</p>
        </Link>
      ))}
    </div>
  );
}

export function DocHero({ badge, title, desc, endpoint }: { badge: string; title: string; desc: string; endpoint: string }) {
  return (
    <div className="rounded-[22px] bg-gradient-to-br from-[#14213D] via-[#1B3260] to-[#274B8F] text-white p-6 sm:p-8 shadow-soft">
      <span className="inline-block rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[11px] font-extrabold tracking-widest">{badge}</span>
      <h1 className="text-2xl sm:text-[28px] font-extrabold mt-3 leading-tight">{title}</h1>
      <p className="text-white/75 text-sm leading-6 mt-1.5 max-w-2xl">{desc}</p>
      <div className="mt-4 rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
        <div className="text-[10px] font-extrabold tracking-widest text-white/60">ENDPOINT CHÍNH</div>
        <div className="font-mono text-[13px] sm:text-sm mt-0.5 whitespace-nowrap overflow-x-auto pb-1">{endpoint}</div>
      </div>
    </div>
  );
}

export function ChipNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} className="rounded-full bg-[#EEF3FF] hover:bg-[#DCE7FF] text-[#2B4C9B] text-[13px] font-semibold px-3.5 py-1.5">{i.label}</a>
      ))}
    </div>
  );
}

export function Section({ no, id, title, children }: { no: number; id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="card !rounded-[22px] p-5 sm:p-6 scroll-mt-24">
      <h2 className="text-lg font-extrabold text-navy mb-3">{no}. {title}</h2>
      <div className="space-y-4 text-sm leading-6 text-slate-600">{children}</div>
    </section>
  );
}

export function KVTable({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="rounded-2xl border border-[#E7EDF7] overflow-hidden">
      {rows.map(([k, v], i) => (
        <div key={i} className={`grid sm:grid-cols-[180px_1fr] ${i % 2 ? "bg-[#F8FAFE]" : "bg-white"}`}>
          <div className="px-4 pt-2.5 pb-0 sm:py-2.5 text-[13px] sm:text-sm font-semibold text-navy">{k}</div>
          <div className="px-4 pb-2.5 pt-0.5 sm:py-2.5 font-mono text-[13px] text-[#C2438F] break-all">{v}</div>
        </div>
      ))}
    </div>
  );
}

export function ParamTable({ rows }: { rows: { name: string; required: boolean; example: string; desc: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#E7EDF7]">
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="bg-[#F2F6FD] text-left">
            <th className="px-4 py-2.5 font-bold text-navy">Trường</th>
            <th className="px-4 py-2.5 font-bold text-navy">Bắt buộc</th>
            <th className="px-4 py-2.5 font-bold text-navy">Ví dụ</th>
            <th className="px-4 py-2.5 font-bold text-navy">Mô tả</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 ? "bg-[#F8FAFE]" : "bg-white"}>
              <td className="px-4 py-2.5 font-mono text-[13px] text-[#C2438F] whitespace-nowrap">{r.name}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">{r.required ? "Bắt buộc" : "Không bắt buộc"}</td>
              <td className="px-4 py-2.5 font-mono text-[13px] break-all min-w-[170px]">{r.example}</td>
              <td className="px-4 py-2.5">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SimpleTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#E7EDF7]">
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="bg-[#F2F6FD] text-left">{head.map((h, i) => <th key={i} className="px-4 py-2.5 font-bold text-navy">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 ? "bg-[#F8FAFE]" : "bg-white"}>
              {r.map((c, j) => <td key={j} className="px-4 py-2.5 align-top">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Code({ children }: { children: string }) {
  return (
    <pre className="rounded-2xl bg-[#0F1D38] text-[#DCE7FA] px-4 py-3.5 text-[12.5px] leading-6 overflow-x-auto whitespace-pre font-mono">{children}</pre>
  );
}

export function SignBox({ title, formula, note }: { title: string; formula: string; note?: string }) {
  return (
    <div>
      <div className="text-xs font-extrabold tracking-wider text-[#A08B62] uppercase">{title}</div>
      <div className="mt-1.5 rounded-xl bg-[#F4F8FF] border border-[#DCE7FA] px-3.5 py-2.5 font-mono text-[13px] text-navy break-all">{formula}</div>
      {note && <p className="text-[13px] text-slate-500 mt-1.5">{note}</p>}
    </div>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

export function SubTitle({ children }: { children: ReactNode }) {
  return <h3 className="font-bold text-navy text-[15px]">{children}</h3>;
}
