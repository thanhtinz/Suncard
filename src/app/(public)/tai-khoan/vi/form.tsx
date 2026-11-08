"use client";
import { useState } from "react";
import type { SavedBank } from "./bank-accounts";

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
export function WithdrawForm({ banks = [] }: { banks?: SavedBank[] }) {
  const def = banks.find((b) => b.isDefault) ?? banks[0];
  const [amount, setAmount] = useState("");
  const [pickedId, setPickedId] = useState(def?.id ?? "");
  const [bank, setBank] = useState(def?.bankName ?? "");
  const [account, setAccount] = useState(def?.accountNumber ?? "");
  const [owner, setOwner] = useState(def?.accountName ?? "");
  const { msg, busy, post } = usePost("/api/wallet/withdraw");

  function pick(id: string) {
    setPickedId(id);
    const b = banks.find((x) => x.id === id);
    if (b) { setBank(b.bankName); setAccount(b.accountNumber); setOwner(b.accountName); }
    else { setBank(""); setAccount(""); setOwner(""); }
  }

  return (
    <form className="card p-5 space-y-3" onSubmit={async (e) => { e.preventDefault(); await post({ amountMinor: Number(amount), bankInfo: { bankName: bank, accountNumber: account, accountName: owner } }); }}>
      <h3 className="font-bold text-navy">Rút tiền</h3>
      <div><label className="label">Số tiền (VND)</label><input type="number" min={50000} step={1000} className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      {banks.length > 0 ? (
        <div>
          <label className="label">Ngân hàng đã lưu</label>
          <select className="input" value={pickedId} onChange={(e) => pick(e.target.value)}>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>{b.bankName} — {b.accountNumber}{b.isDefault ? " (mặc định)" : ""}</option>
            ))}
            <option value="">Nhập thông tin khác…</option>
          </select>
        </div>
      ) : (
        <div className="rounded-lg bg-amber-50 text-amber-700 px-3 py-2 text-sm">
          Bạn chưa lưu ngân hàng nào. Cứ nhập thủ công lần này, hoặc thêm ngân hàng ở mục <b>Ngân hàng của tôi</b> bên dưới để lần sau chỉ cần chọn.
        </div>
      )}
      <div><label className="label">Ngân hàng</label><input className="input" value={bank} onChange={(e) => setBank(e.target.value)} required /></div>
      <div><label className="label">Số tài khoản</label><input className="input" value={account} onChange={(e) => setAccount(e.target.value)} required /></div>
      <div><label className="label">Chủ tài khoản</label><input className="input" value={owner} onChange={(e) => setOwner(e.target.value)} required /></div>
      <M msg={msg} /><button className="btn-primary w-full" disabled={busy}>Gửi yêu cầu rút</button>
    </form>
  );
}
