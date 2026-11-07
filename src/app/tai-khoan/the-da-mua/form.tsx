"use client";
import { useState } from "react";
export default function RevealButton({ deliveryId, productName }: { deliveryId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<{ serial: string; pin: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function reveal(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/cards/${deliveryId}/reveal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Không hiển thị được mã");
      const serial = d.serial ?? d.data?.serial ?? "";
      const pin = d.pin ?? d.data?.pin ?? "";
      if (!serial && !pin) throw new Error("Phản hồi không có mã thẻ");
      setResult({ serial, pin }); setPassword("");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Không hiển thị được mã"); }
    setBusy(false);
  }
  if (result) return (
    <div className="rounded-lg bg-green-50 px-3 py-2 text-sm space-y-1">
      <div>{productName}</div>
      <div>Serial: <b className="select-all">{result.serial}</b></div>
      <div>PIN: <b className="select-all">{result.pin}</b></div>
      <div className="text-xs text-slate-500">Mã chỉ hiển thị trong phiên này. Hãy lưu lại nơi an toàn.</div>
    </div>
  );
  if (!open) return <button className="btn-primary" onClick={() => setOpen(true)}>Xem mã</button>;
  return (
    <form onSubmit={reveal} className="flex flex-wrap gap-2 items-center">
      <input type="password" className="input max-w-[220px]" placeholder="Nhập lại mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button className="btn-primary" disabled={busy}>Xác nhận</button>
      <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Huỷ</button>
      {msg && <span className="text-sm text-red-600 w-full">{msg}</span>}
    </form>
  );
}
