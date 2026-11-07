"use client";
import { useState } from "react";
const CARRIER_FACES: Record<string, number[]> = {
  Viettel: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000],
  Mobifone: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000],
  Vinaphone: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000],
  Vietnamobile: [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000],
  Garena: [5000, 10000, 20000, 50000, 100000, 200000, 500000],
  Zing: [10000, 20000, 50000, 100000, 200000, 500000, 1000000],
  Vcoin: [10000, 20000, 50000, 100000, 200000, 300000, 500000, 1000000, 2000000, 5000000, 10000000],
  Gate: [10000, 20000, 50000, 100000, 200000, 300000, 500000, 1000000, 2000000, 5000000, 10000000],
  Scoin: [10000, 20000, 50000, 100000, 200000, 300000, 500000, 1000000, 2000000, 5000000],
};
const CARRIERS = Object.keys(CARRIER_FACES);
export default function ExchangeForm({ loggedIn }: { loggedIn: boolean }) {
  const [carrier, setCarrier] = useState("Viettel");
  const [serial, setSerial] = useState("");
  const [pin, setPin] = useState("");
  const [face, setFace] = useState(100000);
  const faces = CARRIER_FACES[carrier] ?? CARRIER_FACES.Viettel;
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!loggedIn) { setMsg("Vui lòng đăng nhập để gạch thẻ."); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ carrier, serial, pin, faceValueMinor: face, idempotencyKey: crypto.randomUUID() }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Gạch thẻ thất bại");
      setMsg(`Đã gửi thẻ. Mã đơn: ${d.code ?? d.data?.code ?? d.id ?? ""}. Theo dõi tại Tài khoản → Đổi thẻ.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Gạch thẻ thất bại"); }
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="card p-5 space-y-4">
      <div><label className="label">Nhà mạng / loại thẻ</label>
        <select className="input" value={carrier} onChange={(e) => { const c = e.target.value; setCarrier(c); if (!CARRIER_FACES[c].includes(face)) setFace(CARRIER_FACES[c].includes(100000) ? 100000 : CARRIER_FACES[c][0]); }}>{CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
      <div><label className="label">Số serial</label><input className="input" value={serial} onChange={(e) => setSerial(e.target.value)} required /></div>
      <div><label className="label">Mã thẻ (PIN)</label><input className="input" value={pin} onChange={(e) => setPin(e.target.value)} required /></div>
      <div><label className="label">Mệnh giá khai báo</label>
        <select className="input" value={face} onChange={(e) => setFace(Number(e.target.value))}>{faces.map((f) => <option key={f} value={f}>{f.toLocaleString("vi-VN")} ₫</option>)}</select></div>
      {!loggedIn && <div className="rounded-lg bg-amber-50 text-amber-700 px-3 py-2 text-sm">Bạn chưa đăng nhập. <a className="underline font-medium" href="/dang-nhap">Đăng nhập</a> để gạch thẻ.</div>}
      {msg && <div className="rounded-lg bg-blue-50 text-blue-700 px-3 py-2 text-sm">{msg}</div>}
      <button className="btn-primary w-full" disabled={busy}>Gạch thẻ</button>
      <p className="text-xs text-slate-500">Khai sai mệnh giá có thể bị tính phí theo mệnh giá thực tế hoặc từ chối. Kiểm tra kỹ serial và mã thẻ trước khi gửi.</p>
    </form>
  );
}
