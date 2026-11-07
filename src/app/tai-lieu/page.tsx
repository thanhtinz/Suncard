import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageTitle, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DocsHubPage() {
  // Bài viết công khai đã tách sang /bai-viet; trang này là cổng Tài liệu:
  // tài liệu API + tài liệu theo đối tượng (đại lý / đối tác).
  const docs = await prisma.document.findMany({
    where: { audience: { in: ["PARTNER", "AGENT"] }, status: "PUBLISHED" },
    orderBy: { createdAt: "asc" },
  });
  return (
    <div>
      <PageTitle title="Tài liệu" sub="Tài liệu tích hợp API và tài liệu dành cho đại lý, đối tác" />
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Link href="/tai-lieu/api" className="card !rounded-[22px] p-6 block hover:shadow-md transition">
          <div className="font-extrabold text-navy text-lg">Tài liệu API</div>
          <p className="text-sm text-slate-500 mt-1.5 leading-6">Hướng dẫn tích hợp 4 module: Đổi thẻ cào (Charging), Nạp topup (Recharge), Mua mã thẻ (Softcard) và REST API v1 ký HMAC — kèm công thức sign và code mẫu 5 ngôn ngữ.</p>
          <span className="text-sm text-sundeep font-semibold mt-2 inline-block">Xem tài liệu API →</span>
        </Link>
        <Link href="/bai-viet" className="card !rounded-[22px] p-6 block hover:shadow-md transition">
          <div className="font-extrabold text-navy text-lg">Bài viết & hướng dẫn</div>
          <p className="text-sm text-slate-500 mt-1.5 leading-6">Hướng dẫn sử dụng dịch vụ, thông báo và kiến thức về thẻ cào, nạp game dành cho mọi người dùng.</p>
          <span className="text-sm text-sundeep font-semibold mt-2 inline-block">Đọc bài viết →</span>
        </Link>
      </div>
      {docs.length > 0 && (
        <section>
          <h2 className="font-bold text-navy mb-3">Tài liệu theo đối tượng</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {docs.map((d) => (
              <Link key={d.id} href={`/tai-lieu/${d.slug}`} className="card p-5 hover:shadow-md transition">
                <div className="font-semibold">{d.title}</div>
                <div className="text-xs text-slate-400 mt-1">Đối tượng: {d.audience === "AGENT" ? "Đại lý" : "Đối tác"} · Cập nhật {d.updatedAt.toLocaleDateString("vi-VN")}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
