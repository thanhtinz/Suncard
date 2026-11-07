"use client";
import { useState } from "react";
export default function ExchangeDecision({ orderId }: { orderId: string }) {
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function decide(decision: "APPROVE" | "REJECT") {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/admin/exchange/${orderId}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, acceptedValueMinor: value ? Number(value) : undefined }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Thao tác thất bại");
      setMsg(decision === "APPROVE" ? "Đã duyệt" : "Đã từ chối");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Thao tác thất bại"); }
    setBusy(false);
  }
  return (
    <span className="flex flex-wrap gap-1 items-center">
      <input className="input max-w-[130px]" placeholder="Giá trị chấp nhận" value={value} onChange={(e) => setValue(e.target.value)} />
      <button className="btn-primary !px-2 !py-1" disabled={busy} onClick={() => decide("APPROVE")}>Duyệt</button>
      <button className="btn-danger !px-2 !py-1" disabled={busy} onClick={() => decide("REJECT")}>Từ chối</button>
      {msg && <span className="text-xs text-slate-500 w-full">{msg}</span>}
    </span>
  );
}
