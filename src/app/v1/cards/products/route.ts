import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
export async function GET(req: Request) {
  return withPartner(req, async () => {
    const products = await prisma.product.findMany({ where: { type: "CARD_PIN", isActive: true } });
    const variants = await prisma.productVariant.findMany({ where: { productId: { in: products.map((p) => p.id) }, isActive: true } });
    const stock = await prisma.cardInventory.groupBy({ by: ["variantId"], where: { status: "AVAILABLE" }, _count: true });
    return partnerOk({ products: products.map((p) => ({ ...p, variants: variants.filter((v) => v.productId === p.id).map((v) => ({ id: v.id, sku: v.sku, name: v.name, face_value_minor: v.faceValueMinor.toString(), price_minor: v.basePriceMinor.toString(), stock: stock.find((s) => s.variantId === v.id)?._count ?? 0 })) })) });
  });
}
