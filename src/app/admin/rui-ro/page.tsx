import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable } from "@/components/ui";
import DecisionButtons from "./decision-buttons";

export const dynamic = "force-dynamic";

export default async function FraudQueuePage() {
  const reviews = await prisma.riskReview.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const users = await prisma.user.findMany({ where: { id: { in: reviews.map((r) => r.userId) } } });
  return (
    <div>
      <PageTitle title="Hàng chờ rủi ro (Fraud Queue)" sub="Đơn/mã bị Risk Engine giữ ở mức HIGH/CRITICAL kèm điểm và tín hiệu. Duyệt để giao tiếp, từ chối để huỷ và hoàn tiền giữ." />
      <DataTable cols={["Thời gian", "Người dùng", "Hành động", "Đơn", "Điểm / Mức", "Tín hiệu", "Trạng thái", ""]} rows={reviews.map((r) => {
        const sig = (r.signals as { key: string; points: number }[] | null) ?? [];
        return [
          r.createdAt.toLocaleString("vi-VN"),
          users.find((u) => u.id === r.userId)?.email ?? r.userId.slice(0, 8),
          r.action, r.orderId ? r.orderId.slice(0, 8) + "…" : "—",
          <span key="s" className={`badge ${r.level === "CRITICAL" ? "bg-red-100 text-red-700" : r.level === "HIGH" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{r.score} · {r.level}</span>,
          <span key="g" className="text-xs">{sig.map((x) => `${x.key}(+${x.points})`).join(", ")}</span>,
          r.status,
          r.status === "PENDING" ? <DecisionButtons key="d" id={r.id} /> : (r.reviewedBy ? "đã xử lý" : "—"),
        ];
      })} />
    </div>
  );
}
