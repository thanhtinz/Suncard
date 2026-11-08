"use client";
import { useState } from "react";
export function CreateTicketForm() {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [orderId, setOrderId] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, category, orderId: orderId || undefined, body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Tạo ticket thất bại");
      setMsg("Đã tạo ticket. Danh sách sẽ cập nhật khi tải lại trang.");
      setSubject(""); setBody(""); setOrderId("");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Tạo ticket thất bại"); }
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="card p-5 space-y-3">
      <div><label className="label">Tiêu đề</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} required /></div>
      <div className="grid md:grid-cols-2 gap-3">
        <div><label className="label">Danh mục</label><select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="GENERAL">Chung</option><option value="ORDER">Đơn hàng</option><option value="WALLET">Ví tiền</option><option value="CARD">Thẻ đã mua</option><option value="EXCHANGE">Gạch thẻ</option>
        </select></div>
        <div><label className="label">Mã đơn liên quan (tuỳ chọn)</label><input className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)} /></div>
      </div>
      <div><label className="label">Nội dung</label><textarea className="input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} required /></div>
      {msg && <div className="rounded-lg bg-blue-50 text-blue-700 px-3 py-2 text-sm">{msg}</div>}
      <button className="btn-primary" disabled={busy}>Tạo ticket</button>
    </form>
  );
}
export function ReplyForm({ ticketId }: { ticketId: string }) {
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/tickets/${ticketId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message ?? d?.message ?? "Gửi thất bại");
      setBody(""); setMsg("Đã gửi. Tải lại trang để xem hội thoại mới nhất.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Gửi thất bại"); }
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="card p-5 space-y-3">
      <label className="label">Trả lời</label>
      <textarea className="input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} required />
      {msg && <div className="rounded-lg bg-blue-50 text-blue-700 px-3 py-2 text-sm">{msg}</div>}
      <button className="btn-primary" disabled={busy}>Gửi trả lời</button>
    </form>
  );
}
