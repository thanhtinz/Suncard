import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
export async function GET(req: Request) {
  return withPartner(req, async () => {
    const categories = await prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    return partnerOk({ categories });
  });
}
