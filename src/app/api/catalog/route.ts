import { prisma } from "@/lib/prisma";
import { ok, fail, serialize } from "@/lib/api";
export async function GET() {
  try {
    const [categories, products, variants, games] = await Promise.all([
      prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      prisma.product.findMany({ where: { isActive: true } }),
      prisma.productVariant.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      prisma.gameCatalog.findMany({ where: { isActive: true } }),
    ]);
    return ok(serialize({ categories, products, variants, games }));
  } catch (e) { return fail(e); }
}
