import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageTitle, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const docs = await prisma.document.findMany({ where: { audience: { in: ["PUBLIC", "PARTNER", "AGENT"] }, status: "PUBLISHED" }, orderBy: { createdAt: "asc" } });
  return (
    <div>
      <PageTitle title="Tài liệu" sub="Hướng dẫn sử dụng và tài liệu tích hợp cho đối tác, đại lý" />
      <Link href="/tai-lieu/api" className="card p-5 block mb-4 hover:shadow-md transition">
        <div className="font-bold text-navy">Partner API</div>
        <p className="text-sm text-slate-500 mt-1">Tích hợp đặt đơn, tra cứu trạng thái và webhook qua API có ký HMAC. Xem mô tả và file OpenAPI.</p>
      </Link>
      {docs.length === 0 ? <Empty text="Chưa có tài liệu nào" /> : (
        <div className="grid md:grid-cols-2 gap-4">
          {docs.map((d) => (
            <Link key={d.id} href={`/tai-lieu/${d.slug}`} className="card p-5 hover:shadow-md transition">
              <div className="font-semibold">{d.title}</div>
              <div className="text-xs text-slate-400 mt-1">Đối tượng: {d.audience} · Cập nhật {d.updatedAt.toLocaleDateString("vi-VN")}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
