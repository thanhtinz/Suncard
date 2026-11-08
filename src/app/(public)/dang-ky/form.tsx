"use client";
import { useState } from "react";
export default function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, fullName, phone: phone || undefined }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Đăng ký thất bại");
      window.location.href = "/tai-khoan";
    } catch (e) { setMsg(e instanceof Error ? e.message : "Đăng ký thất bại"); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="card p-6 space-y-4">
      <div><label className="label">Họ và tên</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
      <div><label className="label">Email</label><input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div><label className="label">Số điện thoại (không bắt buộc)</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <div><label className="label">Mật khẩu</label><input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></div>
      {msg && <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{msg}</div>}
      <button className="btn-primary w-full" disabled={busy}>Đăng ký</button>
    </form>
  );
}
