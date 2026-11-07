"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AgentReviewControls({ id, levels }: { id: string; levels: { id: string; name: string }[] }) {
  const router = useRouter();
  const [levelId, setLevelId] = useState(levels[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function act(action: string) {
    if (action === "reject" && !note.trim() && !confirm("Từ chối mà không ghi lý do?")) return;
    setBusy(true); setErr("");
    const r = await fetch(`/api/admin/agent-applications/${id}/review`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note, levelId: levelId || undefined }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (j.ok) router.refresh();
    else setErr(j.message ?? "Lỗi xử lý");
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[230px]">
      <div className="flex gap-1.5">
        <select className="input !py-1.5 !px-2 text-xs flex-1" value={levelId} onChange={(e) => setLevelId(e.target.value)} aria-label="Cấp đại lý khi duyệt">
          {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <input className="input !py-1.5 !px-2.5 text-xs flex-1" placeholder="Ghi chú / lý do từ chối" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex gap-1.5">
        <button className="btn-primary !py-1.5 !px-3 text-xs flex-1" disabled={busy} onClick={() => act("approve")}>Duyệt & tạo đại lý</button>
        <button className="btn-ghost !py-1.5 !px-3 text-xs" disabled={busy} onClick={() => act("reject")}>Từ chối</button>
      </div>
      {err && <div className="text-xs text-red-500">{err}</div>}
    </div>
  );
}
