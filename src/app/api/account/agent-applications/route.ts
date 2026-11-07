import { NextResponse } from "next/server";
import { getSession } from "@/modules/security";
import { applyForAgent } from "@/modules/agent-applications";

const ERRORS: Record<string, string> = {
  FULLNAME_REQUIRED: "Vui lòng nhập họ tên đầy đủ.",
  PHONE_INVALID: "Số điện thoại chưa đúng định dạng.",
  EMAIL_INVALID: "Email chưa đúng định dạng.",
  ALREADY_AGENT: "Tài khoản của bạn đã là đại lý.",
  ALREADY_PENDING: "Bạn đang có một đăng ký chờ duyệt.",
};

/** Nộp form đăng ký làm đại lý (trạng thái chờ admin duyệt). */
export async function POST(req: Request) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, message: "Chưa đăng nhập" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    const app = await applyForAgent(session.userId, {
      fullName: String(b.fullName ?? ""), phone: String(b.phone ?? ""), email: String(b.email ?? ""),
      region: b.region ? String(b.region) : undefined, note: b.note ? String(b.note) : undefined,
    });
    return NextResponse.json({ ok: true, id: app.id, status: app.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: ERRORS[String(e?.message)] ?? "Không gửi được đăng ký. Vui lòng thử lại." }, { status: 400 });
  }
}
