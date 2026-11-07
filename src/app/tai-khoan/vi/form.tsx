"use client";
import { useState } from "react";

function usePost(url: string) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function post(payload: Record<string, unknown>) {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, idempotencyKey: crypto.randomUUID() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Thao tác thất bại");
      setMsg("Thành công. Số dư và sao kê sẽ cập nhật ngay.");
      return true;
    } catch (e) { setMsg(e instanceof Error ? e.message : "Thao tác thất bại"); return false; }
    finally { setBusy(false); }
  }
  return { msg, busy, post };
}
const M = ({ msg }: { msg: string }) => msg ? <div className="rounded-lg bg-blue-50 text-blue-700 px-3 py-2 text-sm">{msg}</div> : null;

export function DepositForm() {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const { msg, busy, post } = usePost("/api/wallet/deposit");
  return (
    <form className="card p-5 space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await post({ amountMinor: Number(amount), method })) setAmount(""); }}>
      <h3 className="font-bold text-navy">Nạp tiền</h3>
      <div><label className="label">Số tiền (VND)</label><input type="number" min={10000} step={1000} className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      <div><label className="label">Phương thức</label><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}><option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option><option value="MOCKPAY">Cổng thanh toán (môi trường thử)</option></select></div>
      <M msg={msg} /><button className="btn-primary w-full" disabled={busy}>Tạo yêu cầu nạp</button>
    </form>
  );
}
export function TransferForm() {
  const [toEmail, setToEmail] = useState("");
  const [amount, setAmount] = useState("");
  const { msg, busy, post } = usePost("/api/wallet/transfer");
  return (
    <form className="card p-5 space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await post({ toEmail, amountMinor: Number(amount) })) { setToEmail(""); setAmount(""); } }}>
      <h3 className="font-bold text-navy">Chuyển tiền nội bộ</h3>
      <div><label className="label">Email người nhận</label><input type="email" className="input" value={toEmail} onChange={(e) => setToEmail(e.target.value)} required /></div>
      <div><label className="label">Số tiền (VND)</label><input type="number" min={1000} step={1000} className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      <M msg={msg} /><button className="btn-primary w-full" disabled={busy}>Chuyển tiền</button>
    </form>
  );
}
export function WithdrawForm() {
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const [owner, setOwner] = useState("");
  const { msg, busy, post } = usePost("/api/wallet/withdraw");
  return (
    <form className="card p-5 space-y-3" onSubmit={async (e) => { e.preventDefault(); await post({ amountMinor: Number(amount), bankInfo: { bankName: bank, accountNumber: account, accountName: owner } }); }}>
      <h3 className="font-bold text-navy">Rút tiền</h3>
      <div><label className="label">Số tiền (VND)</label><input type="number" min={50000} step={1000} className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      <div><label className="label">Ngân hàng</label><input className="input" value={bank} onChange={(e) => setBank(e.target.value)} required /></div>
      <div><label className="label">Số tài khoản</label><input className="input" value={account} onChange={(e) => setAccount(e.target.value)} required /></div>
      <div><label className="label">Chủ tài khoản</label><input className="input" value={owner} onChange={(e) => setOwner(e.target.value)} required /></div>
      <M msg={msg} /><button className="btn-primary w-full" disabled={busy}>Gửi yêu cầu rút</button>
    </form>
  );
}
