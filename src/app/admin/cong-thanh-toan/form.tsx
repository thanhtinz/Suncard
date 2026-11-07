"use client";
import { useState } from "react";

// Cấu hình cổng thanh toán: lưu vào Settings (POST /api/admin/settings), trừ
// hash secret VNPay phải qua API riêng /api/admin/payments/vnpay-secret vì nó
// được MÃ HOÁ AES-GCM trước khi ghi setting vnpay.hash_secret_enc.
// Quy tắc secret: ô nhập trống = giữ nguyên, không ghi; có giá trị mới thì ghi đè.
async function saveSetting(key: string, value: unknown) {
  const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Lưu thất bại");
}

export default function PaymentGatewaysForm({ vnpay, bank }: {
  vnpay: { tmnCode: string; enabled: boolean; returnUrl: string; hasSecret: boolean };
  bank: { bankName: string; accountNumber: string; accountName: string; notePrefix: string };
}) {
  const [tmnCode, setTmnCode] = useState(vnpay.tmnCode);
  const [enabled, setEnabled] = useState(vnpay.enabled);
  const [returnUrl, setReturnUrl] = useState(vnpay.returnUrl);
  const [secret, setSecret] = useState("");
  const [bankName, setBankName] = useState(bank.bankName);
  const [accountNumber, setAccountNumber] = useState(bank.accountNumber);
  const [accountName, setAccountName] = useState(bank.accountName);
  const [notePrefix, setNotePrefix] = useState(bank.notePrefix);
  const [msgV, setMsgV] = useState("");
  const [msgB, setMsgB] = useState("");
  const [busyV, setBusyV] = useState(false);
  const [busyB, setBusyB] = useState(false);

  async function saveVnpay() {
    setBusyV(true); setMsgV("");
    try {
      await saveSetting("vnpay.tmn_code", tmnCode.trim());
      await saveSetting("vnpay.enabled", enabled);
      await saveSetting("vnpay.return_url", returnUrl.trim());
      if (secret.trim()) {
        const r = await fetch("/api/admin/payments/vnpay-secret", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: secret.trim() }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Lưu hash secret thất bại");
        setSecret("");
      }
      setMsgV("Đã lưu cấu hình VNPay");
    } catch (e) { setMsgV(e instanceof Error ? e.message : "Lưu thất bại"); }
    setBusyV(false);
  }

  async function saveBank() {
    setBusyB(true); setMsgB("");
    try {
      await saveSetting("deposit.bank_name", bankName.trim());
      await saveSetting("deposit.bank_account_number", accountNumber.trim());
      await saveSetting("deposit.bank_account_name", accountName.trim());
      await saveSetting("deposit.bank_note_prefix", notePrefix.trim());
      setMsgB("Đã lưu thông tin tài khoản nhận tiền");
    } catch (e) { setMsgB(e instanceof Error ? e.message : "Lưu thất bại"); }
    setBusyB(false);
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4 max-w-2xl">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-qrcode text-sundeep" aria-hidden="true" />
          <h2 className="font-bold text-navy">VNPay</h2>
          <span className={`badge ${vnpay.hasSecret ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{vnpay.hasSecret ? "Đã lưu hash secret (mã hoá)" : "Chưa cấu hình hash secret"}</span>
        </div>
        <div><label className="label">TmnCode</label><input className="input font-mono" value={tmnCode} onChange={(e) => setTmnCode(e.target.value)} placeholder="vd VNPAYMERCHANT" /></div>
        <div><label className="label">Return URL</label><input className="input font-mono" value={returnUrl} onChange={(e) => setReturnUrl(e.target.value)} placeholder="Để trống = dùng /api/payments/vnpay/return của hệ thống" /></div>
        <div>
          <label className="label">Hash secret</label>
          <input type="password" className="input font-mono" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="•••••••• (để trống = giữ nguyên)" autoComplete="new-password" />
          <p className="text-xs text-slate-500 mt-1">Chỉ nhập khi muốn đổi secret. Secret được mã hoá trước khi lưu và không bao giờ hiển thị lại.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-navy">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Bật nạp ví qua VNPay
        </label>
        <div className="flex gap-2 items-center"><button className="btn-primary" disabled={busyV} onClick={saveVnpay}>Lưu VNPay</button>{msgV && <span className="text-xs text-slate-500">{msgV}</span>}</div>
      </div>

      <div className="card p-6 space-y-4 max-w-2xl">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-building-columns text-sundeep" aria-hidden="true" />
          <h2 className="font-bold text-navy">Ngân hàng nội địa nhận tiền</h2>
        </div>
        <p className="text-sm text-slate-500">Tài khoản này hiển thị cho khách khi chọn nạp tiền bằng chuyển khoản ngân hàng.</p>
        <div><label className="label">Tên ngân hàng</label><input className="input" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="vd Vietcombank" /></div>
        <div><label className="label">Số tài khoản</label><input className="input font-mono" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="vd 0123456789" /></div>
        <div><label className="label">Chủ tài khoản</label><input className="input" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="vd CÔNG TY SUNCARD" /></div>
        <div>
          <label className="label">Nội dung chuyển khoản mẫu</label>
          <input className="input font-mono" value={notePrefix} onChange={(e) => setNotePrefix(e.target.value)} placeholder="vd NAP + mã đơn — hệ thống tự khớp tiền theo nội dung" />
        </div>
        <div className="flex gap-2 items-center"><button className="btn-primary" disabled={busyB} onClick={saveBank}>Lưu ngân hàng</button>{msgB && <span className="text-xs text-slate-500">{msgB}</span>}</div>
      </div>
    </div>
  );
}
