"use client";
import { useState } from "react";

// Khối thao tác bảo trì: gọi POST /api/admin/system/maintenance.
// Dọn dữ liệu là thao tác KHÔNG khôi phục được — phải tick xác nhận mới bấm được.
async function maintenance(body: Record<string, unknown>) {
  const r = await fetch("/api/admin/system/maintenance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Thao tác thất bại");
  return d.data as Record<string, unknown>;
}

export default function MaintenanceActions() {
  const [cacheMsg, setCacheMsg] = useState("");
  const [cacheBusy, setCacheBusy] = useState(false);
  const [days, setDays] = useState("180");
  const [understood, setUnderstood] = useState(false);
  const [pruneMsg, setPruneMsg] = useState("");
  const [pruneBusy, setPruneBusy] = useState(false);

  async function clearCache() {
    setCacheBusy(true); setCacheMsg("");
    try {
      await maintenance({ action: "revalidate" });
      setCacheMsg("Đã xoá cache — các trang sẽ được dựng lại ở lần truy cập tiếp theo.");
    } catch (e) { setCacheMsg(e instanceof Error ? e.message : "Thao tác thất bại"); }
    setCacheBusy(false);
  }

  async function prune() {
    setPruneBusy(true); setPruneMsg("");
    try {
      const d = await maintenance({ action: "prune", days: Number(days) });
      setPruneMsg(`Đã dọn: xoá ${d.deletedNotifications} thông báo đã đọc và ${d.deletedAuditLogs} dòng nhật ký kiểm toán cũ hơn ${days} ngày.`);
      setUnderstood(false);
    } catch (e) { setPruneMsg(e instanceof Error ? e.message : "Thao tác thất bại"); }
    setPruneBusy(false);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="card p-5 space-y-3">
        <h2 className="font-bold text-navy"><i className="fa-solid fa-server mr-2" aria-hidden="true" />Cache trang</h2>
        <p className="text-sm text-slate-500">Xoá cache dựng trang của toàn bộ website để nội dung mới (banner, cấu hình hiển thị) áp dụng ngay.</p>
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={cacheBusy} onClick={clearCache}>Xoá cache trang</button>
          {cacheMsg && <span className="text-sm text-slate-500">{cacheMsg}</span>}
        </div>
      </div>

      <div className="card p-5 space-y-3 border-red-200">
        <h2 className="font-bold text-red-700"><i className="fa-solid fa-trash-can mr-2" aria-hidden="true" />Dọn dữ liệu cũ</h2>
        <p className="text-sm text-slate-500">
          Xoá vĩnh viễn: <b>thông báo đã đọc</b> và <b>nhật ký kiểm toán (AuditLog)</b> cũ hơn số ngày chọn. Chỉ dọn đúng 2 bảng này, không đụng tới đơn hàng, ví hay sổ cái.
        </p>
        <p className="text-sm font-semibold text-red-600">
          <i className="fa-solid fa-triangle-exclamation mr-1" aria-hidden="true" />
          Đây là thao tác không khôi phục được — dữ liệu đã xoá không lấy lại được.
        </p>
        <div>
          <label className="label">Xoá dữ liệu cũ hơn</label>
          <select className="input" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="90">90 ngày</option>
            <option value="180">180 ngày</option>
            <option value="365">365 ngày</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          Tôi hiểu thao tác này không khôi phục được
        </label>
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={!understood || pruneBusy} onClick={prune}>Dọn dữ liệu cũ</button>
          {pruneMsg && <span className="text-sm text-slate-500">{pruneMsg}</span>}
        </div>
      </div>
    </div>
  );
}
