"use client";
import { useState } from "react";

// Lưu 1 setting qua API Admin -> Cài đặt (POST /api/admin/settings).
async function saveSetting(key: string, value: unknown) {
  const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Lưu thất bại");
}

function Row({ label, desc, children, onSave }: { label: string; desc: string; children: React.ReactNode; onSave: () => Promise<void> }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setMsg("");
    try { await onSave(); setMsg("Đã lưu"); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Lưu thất bại"); }
    setBusy(false);
  }
  return (
    <tr>
      <td><div className="font-medium">{label}</div><div className="text-xs text-slate-400">{desc}</div></td>
      <td>{children}</td>
      <td><span className="flex gap-2 items-center"><button className="btn-primary !px-3 !py-1.5" disabled={busy} onClick={save}>Lưu</button>{msg && <span className="text-xs text-slate-500">{msg}</span>}</span></td>
    </tr>
  );
}

export default function TransferFeeForm({ feeBps, feeMinMinor, transferMinMinor, dailyLimitMinor }: { feeBps: number; feeMinMinor: number; transferMinMinor: number; dailyLimitMinor: number }) {
  // Code ví đọc key wallet.transfer_fee_bps (bps: 100 bps = 1%). Form cho nhập theo % cho dễ đọc.
  const [feePercent, setFeePercent] = useState(String(feeBps / 100));
  const [feeMin, setFeeMin] = useState(String(feeMinMinor));
  const [min, setMin] = useState(String(transferMinMinor));
  const [daily, setDaily] = useState(String(dailyLimitMinor));
  const num = (s: string) => { const n = Number(s); return Number.isFinite(n) ? n : 0; };
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr><th>Cấu hình</th><th>Giá trị</th><th></th></tr></thead>
        <tbody>
          <Row label="Phí chuyển tiền (%)" desc="Key wallet.transfer_fee_bps — API chuyển ví đang áp dụng (100 bps = 1%)" onSave={async () => {
            const p = num(feePercent);
            if (p < 0 || p > 100) throw new Error("Phí % phải trong khoảng 0–100");
            await saveSetting("wallet.transfer_fee_bps", Math.round(p * 100));
          }}>
            <span className="flex items-center gap-2"><input className="input font-mono" type="number" step="0.01" min="0" max="100" value={feePercent} onChange={(e) => setFeePercent(e.target.value)} /><span className="text-sm text-slate-500">%</span></span>
          </Row>
          <Row label="Phí tối thiểu (VND)" desc="Key wallet.transfer_fee_min_minor — mức phí sàn mỗi lần chuyển" onSave={() => saveSetting("wallet.transfer_fee_min_minor", Math.max(0, Math.round(num(feeMin))))}>
            <input className="input font-mono" type="number" step="1" min="0" value={feeMin} onChange={(e) => setFeeMin(e.target.value)} />
          </Row>
          <Row label="Số tiền chuyển tối thiểu (VND)" desc="Key wallet.transfer_min_minor" onSave={() => saveSetting("wallet.transfer_min_minor", Math.max(0, Math.round(num(min))))}>
            <input className="input font-mono" type="number" step="1" min="0" value={min} onChange={(e) => setMin(e.target.value)} />
          </Row>
          <Row label="Hạn mức chuyển mỗi ngày (VND)" desc="Key wallet.transfer_daily_limit_minor — 0 = chưa đặt hạn mức" onSave={() => saveSetting("wallet.transfer_daily_limit_minor", Math.max(0, Math.round(num(daily))))}>
            <input className="input font-mono" type="number" step="1" min="0" value={daily} onChange={(e) => setDaily(e.target.value)} />
          </Row>
        </tbody>
      </table>
    </div>
  );
}
