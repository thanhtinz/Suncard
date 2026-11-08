"use client";
import { useState } from "react";
export default function InviteForm({ levels }: { levels: { id: string; name: string }[] }) {
  const [email, setEmail] = useState("");
  const [levelId, setLevelId] = useState(levels[0]?.id ?? "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/agent/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, levelId: levelId || undefined }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Gửi lời mời thất bại");
      setMsg("Đã gửi lời mời đại lý tuyến dưới."); setEmail("");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Gửi lời mời thất bại"); }
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="card p-5 space-y-3">
      <h3 className="font-bold text-navy">Mời đại lý tuyến dưới</h3>
      <div><label className="label">Email</label><input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div><label className="label">Cấp đề xuất</label>
        <select className="input" value={levelId} onChange={(e) => setLevelId(e.target.value)}>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
      {msg && <div className="rounded-lg bg-blue-50 text-blue-700 px-3 py-2 text-sm">{msg}</div>}
      <button className="btn-primary" disabled={busy}>Gửi lời mời</button>
    </form>
  );
}
