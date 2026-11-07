"use client";
export default function RevokeButtons({ sessionId }: { sessionId?: string }) {
  async function revoke() {
    await fetch("/api/account/sessions/revoke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sessionId ? { sessionId } : { allOthers: true }) });
    location.reload();
  }
  return <button className="btn-ghost !px-2 !py-1 text-xs" onClick={revoke}>{sessionId ? "Thu hồi" : "Thu hồi mọi phiên khác"}</button>;
}
