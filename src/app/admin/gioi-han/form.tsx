"use client";
import { useState } from "react";

// Cấu hình giới hạn & phiên: giá trị số lưu vào settings qua POST /api/admin/settings.
type FieldDef = { key: string; label: string; desc: string; unit: string };

const FIELDS: FieldDef[] = [
  { key: "session.admin_ttl_minutes", label: "Thời hạn phiên Admin", desc: "Thời gian sống của phiên đăng nhập quản trị (áp dụng cho phiên tạo mới).", unit: "phút" },
  { key: "session.customer_ttl_minutes", label: "Thời hạn phiên khách", desc: "Thời gian sống của phiên đăng nhập khách hàng (áp dụng cho phiên tạo mới).", unit: "phút" },
  { key: "login.max_attempts", label: "Số lần đăng nhập sai tối đa", desc: "Vượt quá số lần này, đăng nhập bị khoá tạm theo thời gian khoá cơ bản.", unit: "lần" },
  { key: "login.lock_base_minutes", label: "Thời gian khoá đăng nhập cơ bản", desc: "Thời gian khoá tạm lần đầu, tăng gấp đôi mỗi lần khoá lặp lại.", unit: "phút" },
  { key: "limits.buy_card_daily_minor", label: "Giới hạn mua thẻ mỗi ngày", desc: "Tổng tiền mua thẻ tối đa của một khách trong ngày (áp dụng khi bật kiểm tra giới hạn).", unit: "VND" },
  { key: "limits.topup_daily_minor", label: "Giới hạn nạp cước/game mỗi ngày", desc: "Tổng tiền nạp cước/game tối đa của một khách trong ngày (áp dụng khi bật kiểm tra giới hạn).", unit: "VND" },
  { key: "limits.withdraw_daily_minor", label: "Giới hạn rút tiền mỗi ngày", desc: "Tổng tiền rút tối đa của một khách trong ngày (áp dụng khi bật kiểm tra giới hạn).", unit: "VND" },
  { key: "limits.transfer_daily_minor", label: "Giới hạn chuyển tiền mỗi ngày", desc: "Tổng tiền chuyển ví nội bộ tối đa của một khách trong ngày (áp dụng khi bật kiểm tra giới hạn).", unit: "VND" },
];

async function saveSetting(key: string, value: unknown) {
  const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Lưu thất bại");
}

export default function LimitsForm({ initial }: { initial: Record<string, string> }) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...initial }));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg("");
    try {
      for (const f of FIELDS) {
        const raw = (values[f.key] ?? "").trim();
        await saveSetting(f.key, raw === "" ? 0 : Number(raw));
      }
      setMsg("Đã lưu cấu hình");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Lưu thất bại"); }
    setBusy(false);
  }

  return (
    <div className="card p-5 space-y-5 max-w-3xl">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="label">{f.label} ({f.unit})</label>
          <input type="number" min={0} className="input" value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
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
