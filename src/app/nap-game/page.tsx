import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageTitle, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NapGamePage() {
  const games = await prisma.gameCatalog.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  const products = await prisma.product.findMany({ where: { id: { in: games.map((g) => g.productId) } } });
  const pmap = new Map(products.map((p) => [p.id, p]));
  return (
    <div>
      <PageTitle title="Nạp game" sub="Chọn game để nạp trực tiếp vào tài khoản của bạn" />
      {games.length === 0 ? <Empty text="Chưa có game nào đang mở nạp" /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {games.map((g) => (
            <Link key={g.id} href={`/nap-game/${g.slug}`} className="card p-4 hover:shadow-md transition">
              <div className="font-semibold">{pmap.get(g.productId)?.name ?? g.slug}</div>
              <div className="text-sm text-slate-500">{g.publisher ?? ""}{g.currencyName ? ` · Đơn vị: ${g.currencyName}` : ""}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
