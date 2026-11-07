"use client";
import { useState } from "react";
export default function FinanceDecision({ kind, id }: { kind: "DEPOSIT" | "WITHDRAWAL"; id: string }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function decide(decision: "APPROVE" | "REJECT") {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/finance/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, decision }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Thao tác thất bại");
      setMsg(decision === "APPROVE" ? "Đã duyệt" : "Đã từ chối");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Thao tác thất bại"); }
    setBusy(false);
  }
  return (
    <span className="flex gap-1 items-center">
      <button className="btn-primary !px-2 !py-1" disabled={busy} onClick={() => decide("APPROVE")}>Duyệt</button>
      <button className="btn-danger !px-2 !py-1" disabled={busy} onClick={() => decide("REJECT")}>Từ chối</button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </span>
  );
}
