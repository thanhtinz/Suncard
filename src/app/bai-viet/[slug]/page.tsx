import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageTitle, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ArticleDetailPage({ params }: { params: { slug: string } }) {
  const doc = await prisma.document.findUnique({ where: { slug: params.slug } });
  if (!doc || doc.status !== "PUBLISHED" || doc.audience !== "PUBLIC") notFound();
  const version = await prisma.documentVersion.findFirst({ where: { documentId: doc.id }, orderBy: { version: "desc" } });
  return (
    <div className="max-w-3xl mx-auto">
      <PageTitle title={doc.title} sub={`Cập nhật ${doc.updatedAt.toLocaleDateString("vi-VN")}`} />
      {!version ? <Empty text="Bài viết chưa có nội dung" /> : (
        <div className="card !rounded-[22px] p-6"><pre className="whitespace-pre-wrap font-sans text-[15px] leading-7 text-slate-700">{version.content}</pre></div>
      )}
      <div className="mt-5">
        <Link href="/bai-viet" className="text-sm text-sundeep font-semibold">← Tất cả bài viết</Link>
      </div>
    </div>
  );
}
