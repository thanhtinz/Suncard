import { NextResponse } from "next/server";
import { getSession } from "@/modules/security";
import { prisma } from "@/lib/prisma";
import { applyForApiClient } from "@/modules/api-applications";

const ERRORS: Record<string, string> = {
  CALLBACK_URL_INVALID: "Callback URL không hợp lệ (phải bắt đầu bằng http:// hoặc https://).",
  CALLBACK_URL_REQUIRED: "Loại API này bắt buộc nhập Callback URL để nhận kết quả.",
  TOO_MANY_PENDING: "Bạn đang có tối đa 3 đăng ký chờ duyệt. Vui lòng chờ admin xử lý.",
  TOO_MANY_CLIENTS: "Bạn đã đạt tối đa 5 kết nối API.",
};

/** Nộp đăng ký kết nối API (trạng thái chờ duyệt, chưa có key). */
export async function POST(req: Request) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, message: "Chưa đăng nhập" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    const client = await applyForApiClient(session.userId, {
      apiType: String(b.apiType ?? "FULL"),
      name: b.name ? String(b.name) : undefined,
      callbackUrl: b.callbackUrl ? String(b.callbackUrl) : undefined,
      callbackMethod: b.callbackMethod ? String(b.callbackMethod) : undefined,
      ipAllowlist: b.ipAllowlist ? String(b.ipAllowlist) : undefined,
    });
    return NextResponse.json({ ok: true, client: { id: client.id, partnerId: client.clientId, status: client.status } });
  } catch (e: any) {
    const msg = ERRORS[String(e?.message)] ?? "Không gửi được đăng ký. Vui lòng thử lại.";
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }
}

/** Huỷ đăng ký của chính mình khi còn chờ duyệt hoặc đã bị từ chối. */
export async function DELETE(req: Request) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, message: "Chưa đăng nhập" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const client = await prisma.apiClient.findUnique({ where: { id } });
  if (!client || client.userId !== session.userId) return NextResponse.json({ ok: false, message: "Không tìm thấy kết nối" }, { status: 404 });
  if (!["PENDING", "REJECTED"].includes(client.status)) return NextResponse.json({ ok: false, message: "Chỉ huỷ được đăng ký chờ duyệt hoặc đã bị từ chối" }, { status: 400 });
  await prisma.apiClient.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
