"use client";
import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";

// Quản lý passkey (Phase 4): đăng ký bằng trình duyệt (WebAuthn), liệt kê, xoá.
// Passkey dùng để đăng nhập và làm step-up thay mật khẩu/TOTP khi xem mã thẻ.
interface PasskeyRow { id: string; deviceName: string; createdAt: string; lastUsedAt: string | null }

export default function PasskeyForm() {
  const [list, setList] = useState<PasskeyRow[]>([]);
  const [name, setName] = useState("Thiết bị của tôi");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const supported = typeof window !== "undefined" && !!window.PublicKeyCredential;

  async function load() {
    const r = await fetch("/api/account/passkeys");
    const d = await r.json().catch(() => ({}));
    if (r.ok) setList(d.data.passkeys ?? []);
  }
  useEffect(() => { load(); }, []);

  async function register() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/account/passkeys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "register-options" }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message ?? "Không tạo được yêu cầu đăng ký");
      const attResp = await startRegistration({ optionsJSON: d.data });
      const v = await fetch("/api/account/passkeys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "register-verify", response: attResp, deviceName: name }) });
      const vd = await v.json();
      if (!v.ok) throw new Error(vd?.error?.message ?? "Xác thực passkey thất bại");
      setMsg("Đã đăng ký passkey thành công.");
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Đã huỷ hoặc lỗi khi đăng ký passkey"); }
    setBusy(false);
  }

  async function remove(id: string) {
    if (!confirm("Xoá passkey này? Bạn sẽ không đăng nhập bằng nó được nữa.")) return;
    const r = await fetch("/api/account/passkeys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    if (r.ok) { setMsg("Đã xoá passkey."); await load(); }
  }

  return (
    <div className="card p-6 space-y-4 mt-6">
      <div>
        <div className="font-semibold text-navy">Passkey (vân tay / khuôn mặt / PIN thiết bị)</div>
        <p className="text-sm text-slate-500 mt-1">Đăng nhập nhanh và an toàn hơn mật khẩu. Passkey cũng dùng được để xác thực lại khi xem mã thẻ (thay mật khẩu/TOTP).</p>
      </div>
      {!supported && <div className="rounded-lg bg-amber-50 text-amber-700 px-3 py-2 text-sm">Trình duyệt/thiết bị hiện tại không hỗ trợ WebAuthn (passkey).</div>}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="grow min-w-52"><label className="label">Tên thiết bị</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
        <button type="button" className="btn-primary" onClick={register} disabled={busy || !supported}>{busy ? "Đang chờ thiết bị..." : "Thêm passkey"}</button>
      </div>
      {msg && <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{msg}</div>}
      {list.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {list.map((p) => (
            <li key={p.id} className="py-3 flex items-center gap-3">
              <div className="grow">
                <div className="font-medium text-navy">{p.deviceName}</div>
                <div className="text-xs text-slate-500">Tạo {new Date(p.createdAt).toLocaleString("vi-VN")}{p.lastUsedAt ? ` · Dùng gần nhất ${new Date(p.lastUsedAt).toLocaleString("vi-VN")}` : " · Chưa dùng"}</div>
              </div>
              <button type="button" className="btn-ghost !text-red-600" onClick={() => remove(p.id)}>Xoá</button>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-slate-500">Chưa có passkey nào.</p>}
    </div>
  );
}
