"use client";
import { useState } from "react";

// Form cấu hình Nội dung & giao diện: mỗi trường lưu vào settings qua
// POST /api/admin/settings {key, value} (đúng mẫu Admin → Cài đặt).
type FieldDef = {
  key: string;
  label: string;
  desc: string;
  type: "text" | "textarea" | "checkbox" | "select";
  options?: { value: string; label: string }[];
};

const FIELDS: FieldDef[] = [
  { key: "content.announcement_enabled", label: "Bật banner thông báo", desc: "Bật hoặc tắt banner thông báo ở đầu trang chủ.", type: "checkbox" },
  { key: "content.announcement_text", label: "Nội dung banner thông báo", desc: "Nội dung hiển thị trên banner thông báo đầu trang chủ.", type: "text" },
  { key: "content.announcement_link", label: "Liên kết của banner", desc: "Đường dẫn khi khách bấm vào banner (để trống = không liên kết).", type: "text" },
  { key: "seo.default_title", label: "Tiêu đề mặc định (SEO)", desc: "Tiêu đề mặc định của trang khi trang con không đặt tiêu đề riêng.", type: "text" },
  { key: "seo.default_description", label: "Mô tả mặc định (SEO)", desc: "Mô tả mặc định dùng cho SEO và khi chia sẻ lên mạng xã hội.", type: "textarea" },
  { key: "site.default_language", label: "Ngôn ngữ mặc định", desc: "Ngôn ngữ mặc định của giao diện phía khách hàng.", type: "select", options: [{ value: "vi", label: "Tiếng Việt" }, { value: "en", label: "English" }] },
  { key: "site.footer_note", label: "Ghi chú chân trang", desc: "Dòng ghi chú hiển thị ở chân trang phía khách hàng.", type: "text" },
];

async function saveSetting(key: string, value: unknown) {
  const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Lưu thất bại");
}

export default function NoiDungForm({ initial }: { initial: Record<string, string | boolean> }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of FIELDS) if (f.type !== "checkbox") o[f.key] = String(initial[f.key] ?? "");
    return o;
  });
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    for (const f of FIELDS) if (f.type === "checkbox") o[f.key] = Boolean(initial[f.key]);
    return o;
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg("");
    try {
      for (const f of FIELDS) {
        if (f.type === "checkbox") await saveSetting(f.key, !!checks[f.key]);
        else await saveSetting(f.key, values[f.key] ?? "");
      }
      setMsg("Đã lưu cấu hình");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lưu thất bại"); }
    setBusy(false);
  }

  return (
    <div className="card p-5 space-y-5 max-w-3xl">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="label">{f.label}</label>
          {f.type === "checkbox" ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!checks[f.key]} onChange={(e) => setChecks({ ...checks, [f.key]: e.target.checked })} />
              Đang {checks[f.key] ? "bật" : "tắt"}
            </label>
          ) : f.type === "textarea" ? (
            <textarea className="input" rows={3} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          ) : f.type === "select" ? (
            <select className="input" value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
              {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input className="input" value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          )}
          <p className="text-xs text-slate-400 mt-1">{f.desc} <span className="font-mono">({f.key})</span></p>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy} onClick={save}><i className="fa-solid fa-floppy-disk mr-2" aria-hidden="true" />Lưu cấu hình</button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}
