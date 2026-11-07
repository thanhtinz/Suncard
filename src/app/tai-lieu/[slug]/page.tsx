import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageTitle, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DocDetailPage({ params }: { params: { slug: string } }) {
  const doc = await prisma.document.findUnique({ where: { slug: params.slug } });
  if (!doc || doc.status !== "PUBLISHED" || doc.audience === "INTERNAL") notFound();
  const version = await prisma.documentVersion.findFirst({ where: { documentId: doc.id }, orderBy: { version: "desc" } });
  return (
    <div className="max-w-3xl mx-auto">
      <PageTitle title={doc.title} sub={`Phiên bản ${version?.version ?? "—"} · Cập nhật ${doc.updatedAt.toLocaleDateString("vi-VN")}`} />
      {!version ? <Empty text="Tài liệu chưa có nội dung" /> : (
        <div className="card p-6"><pre className="whitespace-pre-wrap font-sans text-sm leading-6">{version.content}</pre></div>
      )}
    </div>
  );
}
