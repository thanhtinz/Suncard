import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminDocsPage({ searchParams }: { searchParams?: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const take = 20;
  const [total, docs] = await Promise.all([
    prisma.document.count(),
    prisma.document.findMany({ orderBy: { updatedAt: "desc" }, skip: (page - 1) * take, take }),
  ]);
  const versions = docs.length ? await prisma.documentVersion.findMany({ where: { documentId: { in: docs.map((d) => d.id) } }, orderBy: { version: "desc" } }) : [];
  const latest = new Map<string, number>();
  for (const v of versions) if (!latest.has(v.documentId)) latest.set(v.documentId, v.version);
  return (
    <div>
      <PageTitle title="Tài liệu" sub={`Tổng ${total} · Trang ${page}`} />
      <DataTable cols={["Slug", "Tiêu đề", "Đối tượng", "Trạng thái", "Phiên bản mới nhất", "Cập nhật"]} rows={docs.map((d) => [
        d.slug, d.audience !== "INTERNAL" ? <Link key="l" className="text-primary" href={`/tai-lieu/${d.slug}`}>{d.title}</Link> : d.title, d.audience, <StatusBadge key="s" status={d.status} />, String(latest.get(d.id) ?? "—"), d.updatedAt.toLocaleString("vi-VN"),
      ])} />
    </div>
  );
}
