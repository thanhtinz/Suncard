import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 30;
  const [total, logs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
  ]);
  const actors = logs.some((l) => l.actorId) ? await prisma.user.findMany({ where: { id: { in: logs.map((l) => l.actorId).filter((x): x is string => !!x) } } }) : [];
  const actorMap = new Map(actors.map((u) => [u.id, u]));
  return (
    <div>
      <PageTitle title="Nhật ký kiểm toán" sub={`Tổng ${total} bản ghi · Trang ${page}`} />
      <DataTable cols={["Thời gian", "Người thực hiện", "Hành động", "Đối tượng", "IP"]} rows={logs.map((l) => [
        l.createdAt.toLocaleString("vi-VN"), l.actorId ? actorMap.get(l.actorId)?.email ?? l.actorId : l.actorType, l.action, `${l.entityType ?? ""}${l.entityId ? ` · ${l.entityId}` : ""}`, l.ip ?? "—",
      ])} />
    </div>
  );
}
