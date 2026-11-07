"use client";
import { useState } from "react";
export default function SettingRow({ k, value, description }: { k: string; value: string; description?: string | null }) {
  const [v, setV] = useState(value);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setMsg("");
    try {
      let parsed: unknown = v;
      try { parsed = JSON.parse(v); } catch { parsed = v; }
      const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: k, value: parsed }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Lưu thất bại");
      setMsg("Đã lưu");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lưu thất bại"); }
    setBusy(false);
  }
  return (
    <tr>
      <td><div className="font-medium">{k}</div>{description && <div className="text-xs text-slate-400">{description}</div>}</td>
      <td><input className="input font-mono" value={v} onChange={(e) => setV(e.target.value)} /></td>
      <td><span className="flex gap-2 items-center"><button className="btn-primary !px-3 !py-1.5" disabled={busy} onClick={save}>Lưu</button>{msg && <span className="text-xs text-slate-500">{msg}</span>}</span></td>
    </tr>
  );
}
