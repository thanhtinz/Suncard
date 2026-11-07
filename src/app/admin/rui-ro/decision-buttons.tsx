"use client";
export default function DecisionButtons({ id }: { id: string }) {
  async function decide(decision: string) {
    const res = await fetch(`/api/admin/fraud/${id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error?.message ?? "Lỗi"); return; }
    location.reload();
  }
  return (
    <span className="flex gap-1">
      <button className="btn-primary !px-2 !py-1 text-xs" onClick={() => decide("APPROVE")}>Duyệt — giao tiếp</button>
      <button className="btn-danger !px-2 !py-1 text-xs" onClick={() => decide("REJECT")}>Từ chối</button>
    </span>
  );
}
