import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminWalletsPage({ searchParams }: { searchParams?: { page?: string; account?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const [total, accounts] = await Promise.all([
    prisma.ledgerAccount.count(),
    prisma.ledgerAccount.findMany({ orderBy: { code: "asc" }, skip: (page - 1) * take, take }),
  ]);
  let entries: Awaited<ReturnType<typeof prisma.ledgerEntry.findMany>> = [];
  let selected = searchParams?.account;
  if (selected) {
    const acc = await prisma.ledgerAccount.findUnique({ where: { code: selected } });
    if (acc) entries = await prisma.ledgerEntry.findMany({ where: { accountId: acc.id }, orderBy: { createdAt: "desc" }, take: 30 });
  }
  const txs = entries.length ? await prisma.ledgerTransaction.findMany({ where: { id: { in: entries.map((e) => e.transactionId) } } }) : [];
  const txMap = new Map(txs.map((t) => [t.id, t]));
  return (
    <div className="space-y-8">
      <PageTitle title="Ví & Sổ cái (Ledger)" sub={`Tổng ${total} tài khoản sổ cái · Trang ${page}`} />
      <DataTable cols={["Mã tài khoản", "Chủ sở hữu", "Loại", "Số dư", "Đang giữ", "Xem sao kê"]} rows={accounts.map((a) => [
        a.code, `${a.ownerType}${a.ownerId ? ` · ${a.ownerId}` : ""}`, a.kind, <Money key="b" v={a.balanceMinor} />, <Money key="h" v={a.heldMinor} />,
        <a key="l" className="text-primary" href={`?account=${encodeURIComponent(a.code)}`}>Xem</a>,
      ])} />
      {selected && (
        <section>
          <h2 className="font-bold text-navy mb-3">Sao kê: {selected}</h2>
          <DataTable cols={["Thời gian", "Mã giao dịch", "Loại", "Chiều", "Số tiền", "Số dư sau"]} rows={entries.map((e) => [
            e.createdAt.toLocaleString("vi-VN"), txMap.get(e.transactionId)?.code ?? "", txMap.get(e.transactionId)?.type ?? "", e.direction, <Money key="m" v={e.amountMinor} />, <Money key="b" v={e.balanceAfterMinor} />,
          ])} />
        </section>
      )}
    </div>
  );
}
