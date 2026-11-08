"use client";
import { useState } from "react";

// Nạp ví qua VNPay (Phase 3): tạo URL thanh toán ở server rồi chuyển hướng sang cổng.
// Tiền chỉ cộng vào ví khi IPN VNPay (đã xác thực chữ ký) báo về — không cộng theo return.
export default function VnpayDepositForm() {
  const [amount, setAmount] = useState("100000");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/payments/vnpay/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountMinor: amount }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message ?? "Không tạo được giao dịch VNPay");
      window.location.href = d.data.payment_url;
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lỗi"); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="card p-5 space-y-3">
      <div className="font-semibold text-navy">Nạp tiền qua VNPay</div>
      <div><label className="label">Số tiền (VNĐ)</label>
        <input className="input" type="number" min={10000} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      {msg && <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{msg}</div>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Đang chuyển hướng..." : "Thanh toán VNPay"}</button>
      <p className="text-xs text-slate-500">Tiền cộng vào ví sau khi VNPay xác nhận giao dịch (IPN), thường trong vài giây.</p>
    </form>
  );
}
