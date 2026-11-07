"use client";
import { useState } from "react";
export default function ImportCardsForm({ variants }: { variants: { id: string; name: string }[] }) {
  const [code, setCode] = useState("");
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const cards = text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const [serial, pin] = l.split(/[,\t;]/).map((x) => x.trim());
        return { serial: serial ?? "", pin: pin ?? "" };
      }).filter((c) => c.serial && c.pin);
      if (cards.length === 0) throw new Error("Chưa có dòng thẻ hợp lệ (mỗi dòng: serial,pin)");
      const r = await fetch("/api/admin/cards/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, variantId, cards }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Nhập kho thất bại");
      setMsg(`Nhập kho thành công ${cards.length} thẻ. Tải lại trang để xem tồn kho.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Nhập kho thất bại"); }
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="card p-5 space-y-3">
      <h3 className="font-bold text-navy">Nhập kho thẻ</h3>
      <div className="grid md:grid-cols-2 gap-3">
        <div><label className="label">Mã lô</label><input className="input" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="VD: LOT-2026-001" /></div>
        <div><label className="label">Mệnh giá</label><select className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>{variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
      </div>
      <div><label className="label">Danh sách thẻ (mỗi dòng: serial,pin)</label><textarea className="input font-mono" rows={6} value={text} onChange={(e) => setText(e.target.value)} required /></div>
      {msg && <div className="rounded-lg bg-blue-50 text-blue-700 px-3 py-2 text-sm">{msg}</div>}
      <button className="btn-primary" disabled={busy}>Nhập kho</button>
    </form>
  );
}
