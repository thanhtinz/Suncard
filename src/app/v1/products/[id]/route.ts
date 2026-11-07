import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
import { ApiError } from "@/modules/security";
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withPartner(req, async () => {
    const product = await prisma.product.findFirst({ where: { OR: [{ id: params.id }, { code: params.id }] } });
    if (!product) throw new ApiError("PRODUCT_NOT_FOUND", 404);
    const variants = await prisma.productVariant.findMany({ where: { productId: product.id, isActive: true } });
    const fields = await prisma.productField.findMany({ where: { productId: product.id }, orderBy: { sortOrder: "asc" } });
    return partnerOk({ product, variants: variants.map((v) => ({ ...v, faceValueMinor: v.faceValueMinor.toString(), basePriceMinor: v.basePriceMinor.toString() })), fields });
  });
}
