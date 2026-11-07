import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageTitle, DataTable, Money, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AgentIntroPage() {
  const levels = await prisma.agentLevel.findMany({ where: { isActive: true }, orderBy: { rank: "asc" } });
  return (
    <div className="space-y-8">
      <PageTitle title="Chương trình đại lý SunCard" sub="Kinh doanh sản phẩm số với chiết khấu theo cấp bậc và hoa hồng mạng lưới nhiều tầng" />
      <div className="grid md:grid-cols-3 gap-4">
        {[
          ["Chiết khấu theo cấp", "Giá mua giảm theo cấp bậc đại lý, áp dụng tự động cho mọi đơn trong mạng lưới."],
          ["Hoa hồng nhiều tầng", "Hưởng hoa hồng trên doanh số của tuyến dưới, đối soát minh bạch theo kỳ."],
          ["Công nợ linh hoạt", "Hạn mức tín dụng theo cấp, theo dõi dư nợ và hạn thanh toán ngay trong cổng đại lý."],
        ].map(([t, d]) => (
          <div key={t} className="card p-5"><div className="font-bold text-navy">{t}</div><p className="text-sm text-slate-500 mt-2">{d}</p></div>
        ))}
      </div>
      <section>
        <h2 className="font-bold text-navy mb-3">Các cấp đại lý</h2>
        {levels.length === 0 ? <Empty text="Chưa có cấp đại lý nào" /> : (
          <DataTable cols={["Cấp", "Tên cấp", "Chiết khấu thêm", "Hạn mức công nợ"]} rows={levels.map((l) => [String(l.rank), l.name, `${(l.discountBps / 100).toFixed(2).replace(/\.?0+$/, "")}%`, <Money key={l.id} v={l.creditLimitMinor} />])} />
        )}
      </section>
      <div className="card p-6 flex flex-wrap items-center gap-4 justify-between">
        <div><div className="font-bold text-navy">Đã là đại lý?</div><p className="text-sm text-slate-500">Vào cổng đại lý để xem mạng lưới, bảng giá và hoa hồng.</p></div>
        <div className="flex gap-2"><Link href="/dai-ly/portal" className="btn-primary">Cổng đại lý</Link><Link href="/dang-ky" className="btn-ghost">Đăng ký tài khoản</Link></div>
      </div>
    </div>
  );
}
