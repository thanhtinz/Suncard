import { prisma } from "@/lib/prisma";
import { withPartner, partnerOk } from "@/lib/partner";
export async function GET(req: Request) {
  return withPartner(req, async () => {
    const url = new URL(req.url);
    const gameId = url.searchParams.get("game_id");
    const regions = await prisma.gameRegion.findMany({ where: gameId ? { gameId } : {} });
    const servers = await prisma.gameServer.findMany({ where: gameId ? { gameId } : {} });
    return partnerOk({ regions, servers });
  });
}
