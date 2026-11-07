import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Danh sách sản phẩm Softcard — GET /api/cardws/products?partner_id=YOUR_PARTNER_ID
// Chỉ cần partner_id của một kết nối đang hoạt động (dữ liệu catalog công khai theo merchant).
export async function GET(req: Request) {
  const partnerId = new URL(req.url).searchParams.get("partner_id") ?? "";
  const client = await prisma.apiClient.findUnique({ where: { clientId: partnerId } });
  if (!client || client.status !== "ACTIVE") {
    return NextResponse.json({ status: 116, message: "Sai chữ ký ký sign" }, { status: 401 });
  }
  const products = await prisma.product.findMany({ where: { type: "CARD_PIN", isActive: true }, orderBy: { name: "asc" } });
  const variants = products.length ? await prisma.productVariant.findMany({ where: { productId: { in: products.map((p) => p.id) }, isActive: true }, orderBy: { faceValueMinor: "asc" } }) : [];
  return NextResponse.json(products.map((p) => ({
    name: p.name,
    slug: p.code.replace(/^CARD-/, "").toLowerCase(),
    service_code: p.code,
    image: p.imageUrl ?? "",
    cardvalue: variants.filter((v) => v.productId === p.id).map((v) => ({
      service_code: p.code,
      value: Number(v.faceValueMinor),
      id: v.id,
    })),
  })));
}
