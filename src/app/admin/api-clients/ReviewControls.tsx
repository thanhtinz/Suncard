"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewControls({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function act(action: string) {
    if (action === "reject" && !note.trim() && !confirm("Từ chối mà không ghi lý do? Người dùng sẽ không biết vì sao bị từ chối.")) return;
    if (action === "suspend" && !confirm("Khoá kết nối này? Mọi API key của nó sẽ ngừng hoạt động ngay.")) return;
    setBusy(true); setErr("");
    const r = await fetch(`/api/admin/api-clients/${id}/review`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (j.ok) router.refresh();
    else setErr(j.message ?? "Lỗi xử lý");
  }

  if (status === "PENDING") {
    return (
      <div className="flex flex-col gap-1.5 min-w-[210px]">
        <input className="input !py-1.5 !px-2.5 text-xs" placeholder="Ghi chú / lý do từ chối" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex gap-1.5">
          <button className="btn-primary !py-1.5 !px-3 text-xs flex-1 whitespace-nowrap" disabled={busy} onClick={() => act("approve")}>Duyệt & cấp key</button>
          <button className="btn-ghost !py-1.5 !px-3 text-xs" disabled={busy} onClick={() => act("reject")}>Từ chối</button>
        </div>
        {err && <div className="text-xs text-red-500">{err}</div>}
      </div>
    );
  }
  if (status === "ACTIVE") return <button className="btn-ghost !py-1.5 !px-3 text-xs" disabled={busy} onClick={() => act("suspend")}>Khoá</button>;
  if (status === "SUSPENDED") return <button className="btn-primary !py-1.5 !px-3 text-xs" disabled={busy} onClick={() => act("activate")}>Mở lại</button>;
  return null;
}
