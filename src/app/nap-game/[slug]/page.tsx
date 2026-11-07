import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/security";
import { getFxRates } from "@/modules/fx";
import TopupForm from "./form";

export const dynamic = "force-dynamic";

export default async function GameDetailPage({ params }: { params: { slug: string } }) {
  const game = await prisma.gameCatalog.findUnique({ where: { slug: params.slug } });
  if (!game || !game.isActive) notFound();
  const product = await prisma.product.findUnique({ where: { id: game.productId } });
  const variants = await prisma.productVariant.findMany({ where: { productId: game.productId, isActive: true }, orderBy: { sortOrder: "asc" } });
  const regions = await prisma.gameRegion.findMany({ where: { gameId: game.id, isActive: true } });
  const servers = await prisma.gameServer.findMany({ where: { gameId: game.id, isActive: true } });
  const session = await getSession().catch(() => null);
  const fx = await getFxRates();
  return (
    <div>
      <TopupForm
        slug={game.slug}
        gameName={product?.name ?? params.slug}
        publisher={game.publisher ?? ""}
        currencyName={game.currencyName ?? ""}
        loggedIn={!!session}
        usdRate={fx.displayEnabled ? fx.vndPerUsd : undefined}
        variants={variants.map((v) => ({ id: v.id, name: v.name, face: v.faceValueMinor.toString(), price: v.basePriceMinor.toString() }))}
        regions={regions.map((r) => ({ code: r.code, name: r.name }))}
        servers={servers.map((s) => ({ code: s.code, name: s.name }))}
      />
      <p className="text-sm text-muted2 mt-4">Gặp sự cố? <Link className="text-sundeep font-semibold hover:underline" href="/tro-giup">Liên hệ hỗ trợ</Link></p>
    </div>
  );
}
