import { NextResponse } from "next/server";
import { getSession, verifyStepUp } from "@/modules/security";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { logAudit } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

/** Chủ sở hữu xem lại API key + partner_key sau khi nhập lại mật khẩu (step-up). Có ghi audit. */
export async function POST(req: Request) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, message: "Chưa đăng nhập" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const clientId = String(b.clientId ?? "");
  const password = String(b.password ?? "");
  const client = await prisma.apiClient.findUnique({ where: { id: clientId } });
  if (!client || client.userId !== session.userId) return NextResponse.json({ ok: false, message: "Không tìm thấy kết nối" }, { status: 404 });
  if (client.status !== "ACTIVE") return NextResponse.json({ ok: false, message: "Kết nối chưa được duyệt hoặc đang bị khoá" }, { status: 400 });
  const okStep = await verifyStepUp(session.userId, password || undefined).catch(() => false);
  if (!okStep) return NextResponse.json({ ok: false, message: "Mật khẩu không đúng" }, { status: 403 });
  const key = await prisma.apiKey.findFirst({ where: { clientId: client.id, status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
  if (!key) return NextResponse.json({ ok: false, message: "Kết nối chưa có key hoạt động" }, { status: 404 });
  await logAudit(prisma as unknown as DB, {
    actorId: session.userId, action: "API_KEY_REVEAL", entityType: "API_CLIENT", entityId: client.id,
    summary: `Xem API key của kết nối ${client.clientId}`,
  }).catch(() => undefined);
  return NextResponse.json({
    ok: true,
    partnerId: client.clientId,
    apiKey: key.keyEnc ? decryptSecret(key.keyEnc) : null,
    secret: key.secretEnc ? decryptSecret(key.secretEnc) : null,
  });
}
