import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/ui";
import { getSession } from "@/modules/security";
import TopupForm from "./form";

export const dynamic = "force-dynamic";

export default async function GameDetailPage({ params }: { params: { slug: string } }) {
  const game = await prisma.gameCatalog.findUnique({ where: { slug: params.slug } });
  if (!game) notFound();
  const product = await prisma.product.findUnique({ where: { id: game.productId } });
  const variants = await prisma.productVariant.findMany({ where: { productId: game.productId, isActive: true }, orderBy: { sortOrder: "asc" } });
  const regions = await prisma.gameRegion.findMany({ where: { gameId: game.id, isActive: true } });
  const servers = await prisma.gameServer.findMany({ where: { gameId: game.id, isActive: true } });
  const session = await getSession().catch(() => null);
  return (
    <div className="max-w-3xl mx-auto">
      <PageTitle title={product?.name ?? params.slug} sub={[product?.description ?? "", game.currencyName ? `Đơn vị trong game: ${game.currencyName}` : ""].filter(Boolean).join(" · ") || undefined} />
      <TopupForm
        loggedIn={!!session}
        variants={variants.map((v) => ({ id: v.id, name: v.name, face: v.faceValueMinor.toString(), price: v.basePriceMinor.toString() }))}
        regions={regions.map((r) => ({ code: r.code, name: r.name }))}
        servers={servers.map((s) => ({ code: s.code, name: s.name }))}
      />
      <p className="text-sm text-slate-500 mt-4">Gặp sự cố? <Link className="text-primary" href="/tro-giup">Liên hệ hỗ trợ</Link></p>
    </div>
  );
}
