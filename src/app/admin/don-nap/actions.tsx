"use client";
import { useState } from "react";
export default function InquiryButton({ orderId }: { orderId: string }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function inquiry() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/admin/orders/${orderId}/inquiry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Inquiry thất bại");
      setMsg(`Đã inquiry: ${d.status ?? d.data?.status ?? "đã gửi"}`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Inquiry thất bại"); }
    setBusy(false);
  }
  return <span className="flex gap-1 items-center"><button className="btn-ghost !px-2 !py-1" disabled={busy} onClick={inquiry}>Inquiry</button>{msg && <span className="text-xs text-slate-500">{msg}</span>}</span>;
}
