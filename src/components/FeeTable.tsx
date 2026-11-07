"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export type FeeRow = { telco: string; face: number; group: string; feeBps: number; penaltyBps: number };

const TELCO_NAMES: Record<string, string> = {
  VIETTEL: "Viettel", VINAPHONE: "Vinaphone", MOBIFONE: "Mobifone", VNMOBI: "Vietnamobile",
  ZING: "Zing", GARENA: "Garena", VCOIN: "Vcoin", GATE: "Gate", SCOIN: "Scoin",
};
const GROUPS: { key: string; name: string }[] = [
  { key: "MEMBER", name: "Thành viên" }, { key: "AGENT", name: "Đại lý" }, { key: "API", name: "Đối tác API" },
];

function pct(bps: number) {
  return `${(bps / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}
function vnd(n: number) {
  return `${n.toLocaleString("vi-VN")} ₫`;
}

export default function FeeTable({ rows }: { rows: FeeRow[] }) {
  const telcos = useMemo(() => {
    const seen: string[] = [];
    for (const r of rows) if (!seen.includes(r.telco)) seen.push(r.telco);
    return seen;
  }, [rows]);
  const [telco, setTelco] = useState(telcos[0] ?? "VIETTEL");
  const faces = useMemo(() => {
    const set = new Map<number, Partial<Record<string, FeeRow>>>();
    for (const r of rows.filter((x) => x.telco === telco)) {
      if (!set.has(r.face)) set.set(r.face, {});
      set.get(r.face)![r.group] = r;
    }
    return [...set.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows, telco]);
  const penalty = rows.find((r) => r.telco === telco)?.penaltyBps ?? 5000;

  // Mũi tên chỉ hướng kéo ngang khi bảng tràn (mobile): bấm là cuộn bảng.
  const scRef = useRef<HTMLDivElement>(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(false);
  const [touched, setTouched] = useState(false);
  const updateArrows = () => {
    const el = scRef.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };
  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telco, faces]);
  const nudge = (dir: 1 | -1) => {
    setTouched(true);
    scRef.current?.scrollBy({ left: dir * 260, behavior: "smooth" });
  };
  const arrowCls = "absolute top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/95 border border-sunline shadow-[0_4px_14px_rgba(20,33,61,.18)] flex items-center justify-center text-sundeep";

  if (rows.length === 0) return <div className="card p-5 text-sm text-slate-500">Bảng phí đang được cập nhật.</div>;
  return (
    <div className="card overflow-hidden !rounded-[22px]">
      <div className="flex flex-wrap gap-1.5 p-3 pb-1" role="tablist" aria-label="Loại thẻ">
        {telcos.map((t) => (
          <button key={t} role="tab" aria-selected={t === telco} onClick={() => setTelco(t)}
            className={`px-4 py-2 rounded-full text-sm font-bold ${t === telco ? "bg-navy text-white" : "text-muted2 hover:bg-orange-50"}`}>
            {TELCO_NAMES[t] ?? t}
          </button>
        ))}
      </div>
      <div className="relative">
      <div ref={scRef} onScroll={() => { setTouched(true); updateArrows(); }} className="overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead>
            <tr className="text-left text-muted2 border-b border-sunline">
              <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Mệnh giá</th>
              {GROUPS.map((g) => <th key={g.key} className="px-5 py-3 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">{g.name}</th>)}
              <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">Thực nhận (Thành viên)</th>
            </tr>
          </thead>
          <tbody>
            {faces.map(([face, byGroup]) => {
              const member = byGroup.MEMBER;
              return (
                <tr key={face} className="border-b border-orange-100 last:border-0">
                  <td className="px-5 py-3 font-bold text-navy whitespace-nowrap">{vnd(face)}</td>
                  {GROUPS.map((g) => (
                    <td key={g.key} className="px-5 py-3">{byGroup[g.key] ? pct(byGroup[g.key]!.feeBps) : "—"}</td>
                  ))}
                  <td className="px-5 py-3 text-sundeep font-bold whitespace-nowrap">
                    {member ? vnd(Math.floor(face * (1 - member.feeBps / 10000))) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canL && (
        <button type="button" onClick={() => nudge(-1)} aria-label="Kéo bảng phí sang trái" className={`${arrowCls} left-1.5`}>
          <i className="fa-solid fa-chevron-left text-[14px]" aria-hidden="true" />
        </button>
      )}
      {canR && (
        <button type="button" onClick={() => nudge(1)} aria-label="Kéo bảng phí sang phải" className={`${arrowCls} right-1.5 ${touched ? "" : "animate-pulse"}`}>
          <i className="fa-solid fa-chevron-right text-[14px]" aria-hidden="true" />
        </button>
      )}
      </div>
      <p className="px-5 py-3 text-xs text-slate-500 bg-orange-50/60">
        Khai sai mệnh giá: tính theo mệnh giá thực tế và trừ thêm phí phạt {pct(penalty)} của mệnh giá nhỏ hơn.
        Phí áp dụng theo nhóm tài khoản của bạn tại thời điểm gạch thẻ.
      </p>
    </div>
  );
}
