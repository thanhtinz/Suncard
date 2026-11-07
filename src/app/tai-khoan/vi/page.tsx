import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { PageTitle, Money, DataTable, StatusBadge, Empty } from "@/components/ui";
import { DepositForm, TransferForm, WithdrawForm } from "./form";
import VnpayDepositForm from "./vnpay-form";
import { vnpayEnabled } from "@/modules/vnpay";

export const dynamic = "force-dynamic";

export default async function WalletPage({ searchParams }: { searchParams?: { page?: string } }) {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/dang-nhap");
  const uid = session.userId;
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const accounts = await prisma.ledgerAccount.findMany({ where: { code: { in: [`WALLET:${uid}:AVAILABLE`, `WALLET:${uid}:HELD`] } } });
  const avail = accounts.find((a) => a.code.endsWith("AVAILABLE"));
  const held = accounts.find((a) => a.code.endsWith("HELD"));
  const entries = accounts.length ? await prisma.ledgerEntry.findMany({ where: { accountId: { in: accounts.map((a) => a.id) } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }) : [];
  const txs = entries.length ? await prisma.ledgerTransaction.findMany({ where: { id: { in: entries.map((e) => e.transactionId) } } }) : [];
  const txMap = new Map(txs.map((t) => [t.id, t]));
  const [deposits, withdrawals] = await Promise.all([
    prisma.deposit.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.withdrawalRequest.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return (
    <div>
      <PageTitle title="Ví của tôi" sub="Nạp, chuyển, rút và sao kê số dư" />
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="card p-5"><div className="text-sm text-slate-500">Số dư khả dụng</div><div className="text-2xl mt-1 text-primary"><Money v={avail?.balanceMinor ?? BigInt(0)} /></div></div>
        <div className="card p-5"><div className="text-sm text-slate-500">Đang giữ</div><div className="text-2xl mt-1"><Money v={held?.balanceMinor ?? BigInt(0)} /></div></div>
      </div>
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <DepositForm /><TransferForm /><WithdrawForm />
      </div>
      {(await vnpayEnabled()) && (
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <VnpayDepositForm />
        </div>
      )}
      <h2 className="font-bold text-navy mb-3">Yêu cầu nạp tiền gần đây</h2>
      <div className="mb-6"><DataTable cols={["Thời gian", "Phương thức", "Số tiền", "Trạng thái"]} rows={deposits.map((d) => [d.createdAt.toLocaleString("vi-VN"), d.method, <Money key="m" v={d.amountMinor} />, <StatusBadge key="s" status={d.status} />])} /></div>
      <h2 className="font-bold text-navy mb-3">Yêu cầu rút tiền gần đây</h2>
      <div className="mb-6"><DataTable cols={["Thời gian", "Số tiền", "Phí", "Trạng thái"]} rows={withdrawals.map((w) => [w.createdAt.toLocaleString("vi-VN"), <Money key="m" v={w.amountMinor} />, <Money key="f" v={w.feeMinor} />, <StatusBadge key="s" status={w.status} />])} /></div>
      <h2 className="font-bold text-navy mb-3">Sao kê ví</h2>
      {entries.length === 0 ? <Empty text="Chưa có biến động số dư" /> : (
        <DataTable cols={["Thời gian", "Loại giao dịch", "Chiều", "Số tiền", "Số dư sau"]} rows={entries.map((e) => [
          e.createdAt.toLocaleString("vi-VN"), txMap.get(e.transactionId)?.type ?? "", e.direction === "CREDIT" ? "Cộng" : "Trừ",
          <Money key="m" v={e.amountMinor} />, <Money key="b" v={e.balanceAfterMinor} />,
        ])} />
      )}
    </div>
  );
}
