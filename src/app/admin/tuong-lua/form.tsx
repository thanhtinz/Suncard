"use client";
import { useState } from "react";

// Cấu hình tường lửa IP: mỗi danh sách nhập 1 IP một dòng, lưu vào settings
// dưới dạng mảng qua POST /api/admin/settings.
async function saveSetting(key: string, value: unknown) {
  const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Lưu thất bại");
}

function toLines(text: string): string[] {
  return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

export default function FirewallForm({ allowlist, blacklist }: { allowlist: string; blacklist: string }) {
  const [allow, setAllow] = useState(allowlist);
  const [block, setBlock] = useState(blacklist);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg("");
    try {
      await saveSetting("security.admin_ip_allowlist", toLines(allow));
      await saveSetting("security.ip_blacklist", toLines(block));
      setMsg("Đã lưu cấu hình");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lưu thất bại"); }
    setBusy(false);
  }

  return (
    <div className="card p-5 space-y-5 max-w-3xl">
      <div>
        <label className="label">Danh sách IP được vào Admin (mỗi dòng 1 IP)</label>
        <textarea className="input font-mono" rows={5} value={allow} onChange={(e) => setAllow(e.target.value)} placeholder={"203.0.113.10\n198.51.100.7"} />
        <p className="text-xs text-red-600 mt-1">
          <i className="fa-solid fa-triangle-exclamation mr-1" aria-hidden="true" />
          Danh sách này đang được áp dụng thật cho khu Admin: chỉ thêm IP của chính bạn — nếu lưu sai IP, bạn sẽ tự khoá chính mình khỏi Admin. Để trống toàn bộ là tắt giới hạn này. <span className="font-mono">(security.admin_ip_allowlist)</span>
        </p>
      </div>
      <div>
        <label className="label">Danh sách IP đen (mỗi dòng 1 IP)</label>
        <textarea className="input font-mono" rows={5} value={block} onChange={(e) => setBlock(e.target.value)} placeholder={"192.0.2.55"} />
        <p className="text-xs text-slate-400 mt-1">Danh sách đen dùng cho kiểm tra rủi ro khi rà soát tài khoản và giao dịch. <span className="font-mono">(security.ip_blacklist)</span></p>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy} onClick={save}><i className="fa-solid fa-floppy-disk mr-2" aria-hidden="true" />Lưu cấu hình</button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}
