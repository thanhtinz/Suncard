"use client";
import { useState } from "react";

export default function MfaForm() {
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  async function setup() {
    setMsg("");
    const res = await fetch("/api/account/mfa/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const j = await res.json();
    if (!res.ok) { setMsg(j.error?.message ?? "Lỗi thiết lập"); return; }
    setSecret(j.data.secret);
    setOtpauth(j.data.otpauth_url);
  }
  async function enable() {
    setMsg("");
    const res = await fetch("/api/account/mfa/enable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const j = await res.json();
    if (!res.ok) { setMsg(j.error?.message ?? "Mã không đúng"); return; }
    setDone(true);
  }
  if (done) return <div className="card p-6 text-ok font-medium">Đã bật xác thực 2 lớp (TOTP). Bạn có thể vào khu vực Admin.</div>;
  return (
    <div className="card p-6 space-y-4 max-w-xl">
      <div>
        <label className="label">Bước 1 — Xác nhận mật khẩu hiện tại</label>
        <div className="flex gap-2">
          <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu hiện tại" />
          <button className="btn-primary whitespace-nowrap" onClick={setup}>Tạo mã thiết lập</button>
        </div>
      </div>
      {secret && (
        <>
          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <div className="font-medium mb-1">Bước 2 — Nhập secret này vào app Authenticator (Google/Microsoft/Authy):</div>
            <code className="break-all font-mono text-primary">{secret}</code>
            <div className="text-slate-500 mt-1 break-all">Hoặc mở liên kết: {otpauth}</div>
          </div>
          <div>
            <label className="label">Bước 3 — Nhập mã 6 số từ app để kích hoạt</label>
            <div className="flex gap-2">
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} />
              <button className="btn-primary whitespace-nowrap" onClick={enable}>Kích hoạt MFA</button>
            </div>
          </div>
        </>
      )}
      {msg && <p className="text-danger text-sm">{msg}</p>}
    </div>
  );
}
