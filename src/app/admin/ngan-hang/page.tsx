import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money } from "@/components/ui";

export const dynamic = "force-dynamic";

// Che giữa số tài khoản: giữ 3 số đầu + 3 số cuối (vd 123 •••• 789).
function maskAccount(n: string): string {
  const s = String(n ?? "").replace(/\s+/g, "");
  if (s.length > 6) return `${s.slice(0, 3)} •••• ${s.slice(-3)}`;
  if (s.length > 2) return `•••• ${s.slice(-2)}`;
  return "••••";
}

type BankInfo = { bankName?: string; accountNumber?: string; accountName?: string };

export default async function AdminBankAccountsPage() {
  const saved = await prisma.savedBankAccount.findMany({ orderBy: [{ userId: "asc" }, { createdAt: "asc" }], take: 1000 }).catch(() => []);
  const userIds = [...new Set(saved.map((b) => b.userId))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Gộp tài khoản đã lưu theo từng khách.
  const byUser = new Map<string, typeof saved>();
  for (const b of saved) {
    const arr = byUser.get(b.userId) ?? [];
    arr.push(b);
    byUser.set(b.userId, arr);
  }

  // Tài khoản xuất hiện trong yêu cầu rút tiền (bankInfo Json) — gộp theo bộ 3 thông tin, đếm số lần dùng.
  const withdrawals = await prisma.withdrawalRequest.findMany({ orderBy: { createdAt: "desc" }, take: 1000, select: { bankInfo: true, amountMinor: true } });
  const usedMap = new Map<string, { info: BankInfo; count: number; total: bigint }>();
  for (const w of withdrawals) {
    const info = (w.bankInfo ?? null) as BankInfo | null;
    if (!info || (!info.bankName && !info.accountNumber)) continue;
    const key = `${info.bankName ?? ""}|${info.accountNumber ?? ""}|${info.accountName ?? ""}`;
    const cur = usedMap.get(key) ?? { info, count: 0, total: 0n };
    cur.count += 1;
    cur.total += w.amountMinor as bigint;
    usedMap.set(key, cur);
  }
  const used = [...usedMap.values()].sort((a, b) => b.count - a.count).slice(0, 50);

  return (
    <div>
      <PageTitle title="Tài khoản ngân hàng" sub={`Khách đã lưu ${saved.length} tài khoản ngân hàng · ${byUser.size} khách · ${used.length} tài khoản từng dùng để rút tiền`} />

      <h2 className="font-bold text-navy mt-2 mb-3">Ngân hàng khách đã lưu</h2>
      {byUser.size === 0 && <DataTable cols={["Khách", "Ngân hàng", "Số tài khoản", "Chủ tài khoản", "Mặc định", "Ngày lưu"]} rows={[]} />}
      {[...byUser.entries()].map(([uid, banks]) => (
        <div key={uid} className="mb-5">
          <div className="text-sm font-semibold text-navy mb-2 flex items-center gap-2">
            <i className="fa-solid fa-user text-sundeep" aria-hidden="true" />
            {userMap.get(uid)?.email ?? uid}
            <span className="badge bg-slate-100 text-slate-600">{banks.length} tài khoản</span>
          </div>
          <DataTable cols={["Ngân hàng", "Số tài khoản", "Chủ tài khoản", "Mặc định", "Ngày lưu"]} rows={banks.map((b) => [
            b.bankName,
            maskAccount(b.accountNumber),
            b.accountName,
            b.isDefault ? <span key="d" className="badge bg-green-100 text-green-700">Mặc định</span> : "—",
            b.createdAt.toLocaleString("vi-VN"),
          ])} />
        </div>
      ))}

      <h2 className="font-bold text-navy mt-8 mb-3">Tài khoản dùng trong yêu cầu rút tiền</h2>
      <DataTable cols={["Ngân hàng", "Số tài khoản", "Chủ tài khoản", "Số lần rút", "Tổng tiền đã yêu cầu"]} rows={used.map((u) => [
        u.info.bankName ?? "—",
        maskAccount(u.info.accountNumber ?? ""),
        u.info.accountName ?? "—",
        String(u.count),
        <Money key="m" v={u.total} />,
      ])} />
    </div>
  );
}
