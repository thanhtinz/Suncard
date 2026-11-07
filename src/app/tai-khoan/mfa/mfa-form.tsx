"use client";
import { useState } from "react";
import Link from "next/link";

export default function MfaForm({ enabled = false, hasSecret = false }: { enabled?: boolean; hasSecret?: boolean }) {
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(enabled);
  const [copied, setCopied] = useState(false);
  // Đã có secret chờ kích hoạt (user quay lại trang này) -> vào thẳng bước nhập mã.
  const [stage, setStage] = useState<"setup" | "activate">(hasSecret && !enabled ? "activate" : "setup");
  const [showReset, setShowReset] = useState(false);

  async function setup() {
    setMsg("");
    const res = await fetch("/api/account/mfa/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(j.error?.message ?? "Lỗi thiết lập"); return; }
    setSecret(j.data.secret);
    setOtpauth(j.data.otpauth_url);
    setStage("activate");
    setShowReset(false);
  }
  async function enable() {
    setMsg("");
    const res = await fetch("/api/account/mfa/enable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(j.error?.message ?? "Mã không đúng"); return; }
    setDone(true);
  }
  async function copySecret() {
    try { await navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard bị chặn — user tự bôi đen sao chép */ }
  }

  if (done) return (
    <div className="card p-6 space-y-3 max-w-xl">
      <div className="text-ok font-semibold flex items-center gap-2"><i className="fa-solid fa-circle-check" aria-hidden="true" /> Đã bật xác thực 2 lớp (TOTP).</div>
      <p className="text-sm text-slate-600">Từ lần đăng nhập sau, hệ thống sẽ hỏi thêm mã 6 số trong app Authenticator sau khi nhập mật khẩu.</p>
      <Link href="/admin" className="btn-primary inline-flex w-fit">Vào khu vực Admin</Link>
    </div>
  );

  const grouped = secret ? secret.replace(/(.{4})/g, "$1 ").trim() : "";

  return (
    <div className="card p-6 space-y-4 max-w-xl">
      {stage === "activate" && !secret && (
        <div className="rounded-lg bg-amber-50 text-amber-800 px-3 py-2 text-sm">
          Bạn đã tạo mã thiết lập trước đó và đã thêm vào app Authenticator — chỉ còn nhập mã 6 số ở bước cuối để kích hoạt. Đừng tạo lại mã mới, mã mới sẽ làm mục đã thêm trong app hết hiệu lực.
        </div>
      )}
      {(stage === "setup" || showReset) && (
        <div>
          <label className="label">{hasSecret || showReset ? "Tạo lại mã thiết lập — xác nhận mật khẩu hiện tại" : "Bước 1 — Xác nhận mật khẩu hiện tại"}</label>
          <div className="flex gap-2">
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu hiện tại" />
            <button className="btn-primary whitespace-nowrap" onClick={setup}>{hasSecret || showReset ? "Tạo mã mới" : "Tạo mã thiết lập"}</button>
          </div>
          {(hasSecret || showReset) && <p className="text-xs text-slate-500 mt-1.5">Mã mới sẽ thay thế mã cũ: hãy xoá mục SunCard cũ trong app Authenticator rồi thêm lại bằng mã mới.</p>}
        </div>
      )}
      {secret && (
        <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-2">
          <div className="font-medium">Bước 2 — Thêm tài khoản vào app Authenticator (Google/Microsoft/Authy):</div>
          <a href={otpauth} className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2">
            <i className="fa-solid fa-qrcode" aria-hidden="true" /> Mở trong app Authenticator
          </a>
          <p className="text-slate-500">Bấm nút trên nếu bạn đang dùng cùng điện thoại đã cài app Authenticator — tài khoản sẽ được thêm tự động, không cần gõ tay. Nếu app không tự mở, nhập thủ công mã bí mật này:</p>
          <div className="flex items-center gap-2">
            <code className="break-all font-mono text-primary bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 grow">{grouped}</code>
            <button type="button" className="btn-ghost border border-slate-200 whitespace-nowrap" onClick={copySecret}>
              <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"}`} aria-hidden="true" /> {copied ? "Đã chép" : "Sao chép"}
            </button>
          </div>
        </div>
      )}
      {stage === "activate" && (
        <div>
          <label className="label">{secret ? "Bước 3 — Nhập mã 6 số từ app để kích hoạt" : "Nhập mã 6 số từ app Authenticator để kích hoạt"}</label>
          <div className="flex gap-2">
            <input className="input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" maxLength={6} inputMode="numeric" autoComplete="one-time-code" />
            <button className="btn-primary whitespace-nowrap" onClick={enable}>Kích hoạt MFA</button>
          </div>
          {!secret && !showReset && (
            <button type="button" className="text-sm text-slate-500 underline underline-offset-2 mt-2" onClick={() => setShowReset(true)}>Chưa thêm được vào app, hoặc đã mất mã thiết lập? Tạo lại mã mới</button>
          )}
        </div>
      )}
      {msg && <p className="text-danger text-sm">{msg}</p>}
    </div>
  );
}
