import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

type BankInfo = { bankName?: string; accountNumber?: string; accountName?: string };

function bankLabel(info: BankInfo | null): string {
  if (!info || (!info.bankName && !info.accountNumber)) return "—";
  const tail = info.accountNumber ? ` ···${String(info.accountNumber).slice(-3)}` : "";
  return `${info.bankName ?? "Ngân hàng"}${tail}`;
}

export default async function AdminBankHistoryPage() {
  const [withdrawals, deposits] = await Promise.all([
    prisma.withdrawalRequest.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.deposit.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const userIds = [...new Set([...withdrawals.map((w) => w.userId), ...deposits.map((d) => d.userId)])];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u.email]));

  return (
    <div>
      <PageTitle title="Lịch sử ngân hàng" sub="Yêu cầu rút tiền và nạp tiền gần nhất qua kênh ngân hàng" />

      <h2 className="font-bold text-navy mt-2 mb-3">Yêu cầu rút tiền gần nhất</h2>
      <DataTable cols={["Khách", "Ngân hàng", "Số tiền", "Phí", "Trạng thái", "Thời gian"]} rows={withdrawals.map((w) => [
        userMap.get(w.userId) ?? w.userId,
        bankLabel(w.bankInfo as BankInfo | null),
        <Money key="m" v={w.amountMinor} />,
        <Money key="f" v={w.feeMinor} />,
        <StatusBadge key="s" status={w.status} />,
        w.createdAt.toLocaleString("vi-VN"),
      ])} />

      <h2 className="font-bold text-navy mt-8 mb-3">Nạp tiền gần nhất</h2>
      <DataTable cols={["Khách", "Số tiền", "Kênh", "Tham chiếu", "Trạng thái", "Thời gian"]} rows={deposits.map((d) => [
        userMap.get(d.userId) ?? d.userId,
        <Money key="m" v={d.amountMinor} />,
        d.method,
        d.reference ?? "—",
        <StatusBadge key="s" status={d.status} />,
        d.createdAt.toLocaleString("vi-VN"),
      ])} />
    </div>
  );
}
