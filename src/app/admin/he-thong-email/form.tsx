"use client";
import { useState } from "react";

// Form cấu hình Email & mẫu email: lưu vào settings qua POST /api/admin/settings.
// Trường mật khẩu SMTP (mail.smtp_pass) chỉ gửi khi nhập mới — để trống = giữ nguyên
// giá trị đã lưu (giống mẫu cấu hình cổng thanh toán), và không bao giờ hiển thị lại.
type FieldDef = {
  key: string;
  label: string;
  desc: string;
  type: "text" | "number" | "select" | "secret" | "textarea";
  options?: { value: string; label: string }[];
  placeholder?: string;
};

const FIELDS: FieldDef[] = [
  {
    key: "mail.provider", label: "Nhà cung cấp gửi mail", desc: "Dịch vụ dùng để gửi email hệ thống.", type: "select",
    options: [
      { value: "", label: "— Chưa chọn —" },
      { value: "gmail-smtp", label: "Gmail (SMTP)" },
      { value: "outlook-smtp", label: "Outlook (SMTP)" },
      { value: "zoho", label: "Zoho Mail" },
      { value: "sendgrid", label: "SendGrid" },
      { value: "ses", label: "Amazon SES" },
    ],
  },
  { key: "mail.from_name", label: "Tên người gửi", desc: "Tên hiển thị trong hộp thư của người nhận.", type: "text", placeholder: "SunCard" },
  { key: "mail.from_email", label: "Email người gửi", desc: "Địa chỉ email gửi đi của hệ thống.", type: "text", placeholder: "no-reply@suncard.vn" },
  { key: "mail.smtp_host", label: "Máy chủ SMTP", desc: "Địa chỉ máy chủ SMTP của nhà cung cấp (với SendGrid/SES có thể để trống nếu dùng API).", type: "text", placeholder: "smtp.gmail.com" },
  { key: "mail.smtp_port", label: "Cổng SMTP", desc: "Cổng kết nối SMTP (thường 587 hoặc 465).", type: "number", placeholder: "587" },
  { key: "mail.smtp_user", label: "Tài khoản SMTP", desc: "Tên đăng nhập SMTP (thường là địa chỉ email).", type: "text" },
  { key: "mail.smtp_pass", label: "Mật khẩu SMTP", desc: "Chỉ nhập khi muốn đặt mới — để trống là giữ nguyên mật khẩu đã lưu, giá trị cũ không hiển thị lại.", type: "secret", placeholder: "Để trống = giữ nguyên" },
  { key: "mail.template_welcome", label: "Mẫu email chào mừng", desc: "Nội dung email gửi cho khách khi đăng ký tài khoản thành công.", type: "textarea" },
  { key: "mail.template_order_done", label: "Mẫu email đơn hoàn thành", desc: "Nội dung email gửi cho khách khi đơn hàng hoàn thành.", type: "textarea" },
];

async function saveSetting(key: string, value: unknown) {
  const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Lưu thất bại");
}

export default function MailForm({ initial }: { initial: Record<string, string> }) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...initial }));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg("");
    try {
      for (const f of FIELDS) {
        const raw = values[f.key] ?? "";
        if (f.type === "secret") {
          if (raw.trim() === "") continue; // rỗng = giữ nguyên
          await saveSetting(f.key, raw);
        } else if (f.type === "number") {
          await saveSetting(f.key, raw.trim() === "" ? 0 : Number(raw));
        } else {
          await saveSetting(f.key, raw);
        }
      }
      setValues((v) => ({ ...v, "mail.smtp_pass": "" }));
      setMsg("Đã lưu cấu hình");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lưu thất bại"); }
    setBusy(false);
  }

  return (
    <div className="card p-5 space-y-5 max-w-3xl">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="label">{f.label}</label>
          {f.type === "select" ? (
            <select className="input" value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
              {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : f.type === "textarea" ? (
            <textarea className="input" rows={4} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          ) : f.type === "secret" ? (
            <input type="password" className="input" autoComplete="new-password" placeholder={f.placeholder} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          ) : (
            <input type={f.type === "number" ? "number" : "text"} className="input" placeholder={f.placeholder} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
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
