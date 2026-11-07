import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk, cursorOf, pageSize } from "@/lib/partner";
export async function GET(req: Request) {
  return withPartner(req, async () => {
    const url = new URL(req.url);
    const products = await prisma.product.findMany({
      where: { isActive: true, ...(url.searchParams.get("category_id") ? { categoryId: url.searchParams.get("category_id")! } : {}) },
      take: pageSize(url) + 1, ...(cursorOf(url) ? { cursor: { id: cursorOf(url)! }, skip: 1 } : {}), orderBy: { createdAt: "asc" },
    });
    const variants = await prisma.productVariant.findMany({ where: { productId: { in: products.map((p) => p.id) }, isActive: true } });
    const hasMore = products.length > pageSize(url);
    const page = hasMore ? products.slice(0, -1) : products;
    return partnerOk({ products: page.map((p) => ({ ...p, variants: variants.filter((v) => v.productId === p.id).map((v) => ({ id: v.id, sku: v.sku, name: v.name, face_value_minor: v.faceValueMinor.toString(), price_minor: v.basePriceMinor.toString(), currency: v.currency })) })), next_cursor: hasMore ? page[page.length - 1].id : null });
  });
}
