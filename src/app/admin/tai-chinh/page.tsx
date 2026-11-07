import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, StatusBadge } from "@/components/ui";
import FinanceDecision from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const [deposits, withdrawals] = await Promise.all([
    prisma.deposit.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, skip: (page - 1) * take, take }),
    prisma.withdrawalRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, skip: (page - 1) * take, take }),
  ]);
  const userIds = Array.from(new Set([...deposits.map((d) => d.userId), ...withdrawals.map((w) => w.userId)]));
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  return (
    <div className="space-y-8">
      <PageTitle title="Tài chính — chờ duyệt" sub="Yêu cầu nạp và rút đang chờ xử lý (maker-checker)" />
      <section>
        <h2 className="font-bold text-navy mb-3">Nạp tiền chờ duyệt</h2>
        <DataTable cols={["Khách", "Phương thức", "Số tiền", "Tham chiếu", "Trạng thái", "Thời gian", "Thao tác"]} rows={deposits.map((d) => [
          userMap.get(d.userId)?.email ?? d.userId, d.method, <Money key="m" v={d.amountMinor} />, d.reference ?? "—", <StatusBadge key="s" status={d.status} />, d.createdAt.toLocaleString("vi-VN"), <FinanceDecision key="a" kind="DEPOSIT" id={d.id} />,
        ])} />
      </section>
      <section>
        <h2 className="font-bold text-navy mb-3">Rút tiền chờ duyệt</h2>
        <DataTable cols={["Khách", "Số tiền", "Phí", "Thông tin ngân hàng", "Trạng thái", "Thời gian", "Thao tác"]} rows={withdrawals.map((w) => [
          userMap.get(w.userId)?.email ?? w.userId, <Money key="m" v={w.amountMinor} />, <Money key="f" v={w.feeMinor} />,
          w.bankInfo ? JSON.stringify(w.bankInfo) : "—", <StatusBadge key="s" status={w.status} />, w.createdAt.toLocaleString("vi-VN"), <FinanceDecision key="a" kind="WITHDRAWAL" id={w.id} />,
        ])} />
      </section>
    </div>
  );
}
