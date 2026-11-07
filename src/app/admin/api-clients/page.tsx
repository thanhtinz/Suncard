import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge } from "@/components/ui";
import { apiTypeLabel } from "@/lib/api-types";
import ReviewControls from "./ReviewControls";

export const dynamic = "force-dynamic";

const CLIENT_BADGE: Record<string, string> = { PENDING: "Chờ duyệt", ACTIVE: "Đang hoạt động", REJECTED: "Bị từ chối", SUSPENDED: "Đã khoá" };

function ClientBadge({ status }: { status: string }) {
  const cls =
    status === "ACTIVE" ? "bg-green-100 text-green-700" :
    status === "PENDING" ? "bg-amber-100 text-amber-700" :
    status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-600";
  return <span className={`badge ${cls}`}>{CLIENT_BADGE[status] ?? status}</span>;
}

export default async function AdminApiClientsPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const [total, clients, pending] = await Promise.all([
    prisma.apiClient.count(),
    prisma.apiClient.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
    prisma.apiClient.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 50 }),
  ]);
  const all = [...pending, ...clients];
  const keys = all.length ? await prisma.apiKey.findMany({ where: { clientId: { in: all.map((c) => c.id) } }, orderBy: { createdAt: "desc" } }) : [];
  const users = all.some((c) => c.userId) ? await prisma.user.findMany({ where: { id: { in: all.map((c) => c.userId).filter((x): x is string => !!x) } } }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const keysOf = (cid: string) => keys.filter((k) => k.clientId === cid);
  const infoCell = (c: (typeof all)[number]) => (
    <div key="i" className="text-xs leading-5 max-w-[280px]">
      <div><span className="whitespace-nowrap">Callback ({c.callbackMethod}):</span> <span className="break-all">{c.callbackUrl ?? "—"}</span></div>
      <div className="text-slate-400">IP: {Array.isArray(c.ipAllowlist) && c.ipAllowlist.length ? (c.ipAllowlist as string[]).join(", ") : "Không giới hạn"}</div>
      {c.reviewNote && <div className="text-slate-400">Ghi chú duyệt: {c.reviewNote}</div>}
    </div>
  );

  return (
    <div className="space-y-8">
      <PageTitle title="API Clients" sub={`Tổng ${total} kết nối · ${pending.length} đang chờ duyệt · Trang ${page}`} />

      <section>
        <h2 className="font-bold text-navy mb-3">Chờ duyệt ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="card p-5 text-sm text-slate-500">Không có đăng ký nào đang chờ duyệt.</div>
        ) : (
          <DataTable cols={["Tên kết nối", "Partner ID", "Chủ sở hữu", "Loại API", "Thông tin", "Ngày đăng ký", "Xử lý"]} rows={pending.map((c) => [
            c.name, c.clientId, c.userId ? userMap.get(c.userId)?.email ?? c.userId : "—", apiTypeLabel(c.apiType ?? "FULL"), infoCell(c),
            c.createdAt.toLocaleString("vi-VN"), <ReviewControls key="rc" id={c.id} status={c.status} />,
          ])} />
        )}
      </section>

      <section>
        <h2 className="font-bold text-navy mb-3">Tất cả kết nối</h2>
        <DataTable cols={["Tên client", "Partner ID", "Chủ sở hữu", "Loại API", "Trạng thái", "API keys", "Ngày tạo", "Thao tác"]} rows={clients.map((c) => [
          c.name, c.clientId, c.userId ? userMap.get(c.userId)?.email ?? c.userId : "—", apiTypeLabel(c.apiType ?? "FULL"), <ClientBadge key="s" status={c.status} />,
          <div key="k" className="space-y-0.5">{keysOf(c.id).length === 0 ? "—" : keysOf(c.id).map((k) => <div key={k.id} className="whitespace-nowrap text-xs">{k.keyPrefix}… · {k.status}{k.lastUsedAt ? ` · dùng ${k.lastUsedAt.toLocaleDateString("vi-VN")}` : ""}</div>)}</div>,
          c.createdAt.toLocaleDateString("vi-VN"), <ReviewControls key="rc" id={c.id} status={c.status} />,
        ])} />
      </section>
    </div>
  );
}
