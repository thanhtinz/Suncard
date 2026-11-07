"use client";
import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
export default function LoginForm({ next }: { next?: string }) {
  const dest = next ?? "/tai-khoan";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pkBusy, setPkBusy] = useState(false);
  async function loginWithPasskey() {
    if (!email.includes("@")) { setMsg("Nhập email trước, rồi bấm đăng nhập bằng passkey"); return; }
    setPkBusy(true); setMsg("");
    try {
      const r = await fetch("/api/auth/passkey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "options", email }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? "Không bắt đầu được đăng nhập passkey");
      const assertion = await startAuthentication({ optionsJSON: d.data });
      const v = await fetch("/api/auth/passkey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", email, response: assertion }) });
      const vd = await v.json().catch(() => ({}));
      if (!v.ok) throw new Error(vd?.error?.message ?? "Đăng nhập bằng passkey thất bại");
      window.location.href = dest;
    } catch (e) { setMsg(e instanceof Error ? e.message : "Đã huỷ đăng nhập bằng passkey"); setPkBusy(false); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Đăng nhập thất bại");
      window.location.href = dest;
    } catch (e) { setMsg(e instanceof Error ? e.message : "Đăng nhập thất bại"); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="card p-6 space-y-4">
      <div><label className="label">Email</label><input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div><label className="label">Mật khẩu</label><input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      {msg && <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{msg}</div>}
      <button className="btn-primary w-full" disabled={busy}>Đăng nhập</button>
      <div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px bg-slate-200 grow" />hoặc<span className="h-px bg-slate-200 grow" /></div>
      <button type="button" className="btn-ghost w-full border border-slate-200" onClick={loginWithPasskey} disabled={pkBusy}>{pkBusy ? "Đang chờ thiết bị..." : "Đăng nhập bằng passkey"}</button>
    </form>
  );
}
