import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminApiClientsPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const [total, clients] = await Promise.all([
    prisma.apiClient.count(),
    prisma.apiClient.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
  ]);
  const keys = clients.length ? await prisma.apiKey.findMany({ where: { clientId: { in: clients.map((c) => c.id) } }, orderBy: { createdAt: "desc" } }) : [];
  const users = clients.some((c) => c.userId) ? await prisma.user.findMany({ where: { id: { in: clients.map((c) => c.userId).filter((x): x is string => !!x) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const keysOf = (cid: string) => keys.filter((k) => k.clientId === cid);
  return (
    <div>
      <PageTitle title="API Clients" sub={`Tổng ${total} · Trang ${page}`} />
      <DataTable cols={["Tên client", "Client ID", "Chủ sở hữu", "Môi trường", "Trạng thái", "API keys", "Ngày tạo"]} rows={clients.map((c) => [
        c.name, c.clientId, c.userId ? userMap.get(c.userId)?.email ?? c.userId : "—", c.environment, <StatusBadge key="s" status={c.status} />,
        <div key="k" className="space-y-0.5">{keysOf(c.id).length === 0 ? "—" : keysOf(c.id).map((k) => <div key={k.id} className="whitespace-nowrap text-xs">{k.keyPrefix} · {k.status}{k.lastUsedAt ? ` · dùng ${k.lastUsedAt.toLocaleDateString("vi-VN")}` : ""}</div>)}</div>,
        c.createdAt.toLocaleDateString("vi-VN"),
      ])} />
    </div>
  );
}
