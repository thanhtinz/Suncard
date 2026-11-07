"use client";
import { useState } from "react";

// Cấu hình đăng nhập mạng xã hội: mỗi kênh gồm công tắc bật/tắt + Client ID +
// Client Secret. Secret chỉ gửi khi nhập mới — để trống = giữ nguyên, không hiển thị lại.
const CHANNELS = [
  { id: "google", label: "Google", icon: "fa-brands fa-google" },
  { id: "facebook", label: "Facebook", icon: "fa-brands fa-facebook" },
  { id: "github", label: "GitHub", icon: "fa-brands fa-github" },
  { id: "microsoft", label: "Microsoft", icon: "fa-brands fa-microsoft" },
] as const;

async function saveSetting(key: string, value: unknown) {
  const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Lưu thất bại");
}

export default function SocialAuthForm({ initial }: { initial: Record<string, string | boolean> }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    for (const c of CHANNELS) o[c.id] = Boolean(initial[`auth.${c.id}_enabled`]);
    return o;
  });
  const [ids, setIds] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const c of CHANNELS) o[c.id] = String(initial[`auth.${c.id}_client_id`] ?? "");
    return o;
  });
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg("");
    try {
      for (const c of CHANNELS) {
        await saveSetting(`auth.${c.id}_enabled`, !!enabled[c.id]);
        await saveSetting(`auth.${c.id}_client_id`, ids[c.id] ?? "");
        const sec = secrets[c.id] ?? "";
        if (sec.trim() !== "") await saveSetting(`auth.${c.id}_client_secret`, sec);
      }
      setSecrets({});
      setMsg("Đã lưu cấu hình");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lưu thất bại"); }
    setBusy(false);
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <p className="text-sm text-slate-500">Thông tin kết nối dùng cho tính năng đăng nhập bằng mạng xã hội; khoá bí mật (Client Secret) không hiển thị lại — chỉ nhập khi muốn đặt mới, để trống là giữ nguyên.</p>
      {CHANNELS.map((c) => (
        <div key={c.id} className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-navy"><i className={`${c.icon} mr-2`} aria-hidden="true" />{c.label}</span>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!enabled[c.id]} onChange={(e) => setEnabled({ ...enabled, [c.id]: e.target.checked })} />
              {enabled[c.id] ? "Đang bật" : "Đang tắt"}
            </label>
          </div>
          <div>
            <label className="label">Client ID</label>
            <input className="input" value={ids[c.id] ?? ""} onChange={(e) => setIds({ ...ids, [c.id]: e.target.value })} />
            <p className="text-xs text-slate-400 mt-1">Mã ứng dụng do {c.label} cấp khi đăng ký OAuth. <span className="font-mono">(auth.{c.id}_client_id)</span></p>
          </div>
          <div>
            <label className="label">Client Secret</label>
            <input type="password" className="input" autoComplete="new-password" placeholder="Để trống = giữ nguyên" value={secrets[c.id] ?? ""} onChange={(e) => setSecrets({ ...secrets, [c.id]: e.target.value })} />
            <p className="text-xs text-slate-400 mt-1">Khoá bí mật của ứng dụng OAuth, không hiển thị lại sau khi lưu. <span className="font-mono">(auth.{c.id}_client_secret)</span></p>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy} onClick={save}><i className="fa-solid fa-floppy-disk mr-2" aria-hidden="true" />Lưu cấu hình</button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}
