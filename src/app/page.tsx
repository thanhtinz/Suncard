import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Money, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const games = await prisma.gameCatalog.findMany({ where: { isActive: true }, take: 12 });
  const products = await prisma.product.findMany({ where: { id: { in: games.map((g) => g.productId) } } });
  const pmap = new Map(products.map((p) => [p.id, p]));
  const featured = await prisma.productVariant.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 8 });
  const prod2 = await prisma.product.findMany({ where: { id: { in: featured.map((v) => v.productId) } } });
  const pmap2 = new Map(prod2.map((p) => [p.id, p]));
  return (
    <div className="space-y-10">
      <section className="card bg-navy text-white p-8 md:p-12" style={{ background: "#14213D" }}>
        <h1 className="text-3xl md:text-4xl font-bold">Nạp game, mua thẻ, gạch thẻ — nhanh và minh bạch</h1>
        <p className="mt-3 text-slate-300 max-w-2xl">SunCard phân phối sản phẩm số đa nhà cung cấp với giá rõ ràng, trạng thái đơn theo thời gian thực và mạng lưới đại lý nhiều tầng.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/nap-game" className="btn-primary">Nạp game ngay</Link>
          <Link href="/cua-hang-the" className="btn bg-white text-navy hover:bg-slate-100">Mua thẻ</Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-navy">Game nổi bật</h2><Link href="/nap-game" className="text-sm text-primary">Xem tất cả</Link></div>
        {games.length === 0 ? <Empty text="Chưa có game nào" /> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {games.map((g) => (
              <Link key={g.id} href={`/nap-game/${g.slug}`} className="card p-4 hover:shadow-md transition">
                <div className="font-semibold">{pmap.get(g.productId)?.name ?? g.slug}</div>
                <div className="text-sm text-slate-500">{g.publisher ?? ""}{g.currencyName ? ` · ${g.currencyName}` : ""}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold text-navy mb-4">Mệnh giá nổi bật</h2>
        {featured.length === 0 ? <Empty text="Chưa có mệnh giá nào" /> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featured.map((v) => (
              <div key={v.id} className="card p-4">
                <div className="text-sm text-slate-500">{pmap2.get(v.productId)?.name ?? ""}</div>
                <div className="font-semibold mt-1">{v.name}</div>
                <div className="mt-2 text-primary"><Money v={v.basePriceMinor} /></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="card p-6">
          <h3 className="font-bold text-navy">Gạch thẻ đổi tiền ví</h3>
          <p className="text-sm text-slate-500 mt-2">Đổi thẻ Viettel, Mobifone, Vinaphone, Garena, Zing sang số dư ví với bảng phí công khai.</p>
          <Link href="/doi-the" className="btn-primary mt-4">Gạch thẻ ngay</Link>
        </div>
        <div className="card p-6">
          <h3 className="font-bold text-navy">Trở thành đại lý SunCard</h3>
          <p className="text-sm text-slate-500 mt-2">Chiết khấu theo cấp bậc, hoa hồng mạng lưới nhiều tầng, hạn mức công nợ và báo cáo minh bạch.</p>
          <Link href="/dai-ly" className="btn-primary mt-4">Tìm hiểu chương trình</Link>
        </div>
      </section>
    </div>
  );
}
