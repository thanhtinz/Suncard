import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DB } from "@/modules/ledger";
import { feeTableForGroup } from "@/modules/charging";

// GET /chargingws/v2/getfee?partner_id= — bảng phí {telco, value, fees, penalty} từ DB (exchange_fee_rules).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const partnerId = url.searchParams.get("partner_id") ?? "";
  const client = await prisma.apiClient.findUnique({ where: { clientId: partnerId } });
  if (!client || client.status !== "ACTIVE") {
    return NextResponse.json({ status: 102, message: "Dữ liệu xác thực không hợp lệ" }, { status: 200 });
  }
  const table = await feeTableForGroup(prisma as unknown as DB, client.feeGroup ?? "API");
  return NextResponse.json(table);
}
