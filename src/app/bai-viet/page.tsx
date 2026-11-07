import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageTitle, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const docs = await prisma.document.findMany({
    where: { audience: "PUBLIC", status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
  });
  const versions = docs.length ? await prisma.documentVersion.findMany({
    where: { documentId: { in: docs.map((d) => d.id) } }, orderBy: { version: "desc" },
  }) : [];
  const excerptOf = (docId: string) => {
    const v = versions.find((x) => x.documentId === docId);
    const text = (v?.content ?? "").replace(/\s+/g, " ").trim();
    return text.length > 150 ? text.slice(0, 150) + "…" : text;
  };
  return (
    <div>
      <PageTitle title="Bài viết & hướng dẫn" sub="Hướng dẫn sử dụng dịch vụ, thông báo và kiến thức về thẻ cào, nạp game" />
      {docs.length === 0 ? <Empty text="Chưa có bài viết nào" /> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((d) => (
            <Link key={d.id} href={`/bai-viet/${d.slug}`} className="card p-5 hover:shadow-md transition flex flex-col">
              <div className="font-bold text-navy leading-6">{d.title}</div>
              <p className="text-sm text-slate-500 leading-6 mt-2 flex-1">{excerptOf(d.id)}</p>
              <div className="text-xs text-slate-400 mt-3">Cập nhật {d.updatedAt.toLocaleDateString("vi-VN")} · <span className="text-sundeep font-semibold">Đọc tiếp →</span></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
