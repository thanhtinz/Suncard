"use client";
import { useState } from "react";

export interface RoutingOption { value: string; label: string }

export default function RoutingRow({ k, label, description, value, options }: { k: string; label: string; description: string; value: string; options: RoutingOption[] }) {
  const [v, setV] = useState(value);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: k, value: v }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Lưu thất bại");
      setMsg("Đã lưu");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lưu thất bại"); }
    setBusy(false);
  }
  return (
    <div className="card p-4 mb-4">
      <label className="label" htmlFor={k}>{label}</label>
      <p className="text-sm text-slate-500 mb-3">{description}</p>
      <div className="flex flex-wrap items-center gap-2">
        <select id={k} className="input max-w-sm" value={v} onChange={(e) => setV(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className="btn-primary" disabled={busy} onClick={save}>Lưu</button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
      <p className="text-xs text-slate-400 mt-2 font-mono">{k}</p>
    </div>
  );
}
