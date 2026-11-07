import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/modules/security";
import { approveAgentApplication, rejectAgentApplication } from "@/modules/agent-applications";

/** Duyệt / từ chối đăng ký làm đại lý. Duyệt = tạo Agent ở cấp được chọn (mặc định cấp thấp nhất đang mở). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "agents.manage");
    const b = await req.json().catch(() => ({}));
    const action = String(b.action ?? "");
    const note = b.note ? String(b.note) : undefined;
    if (action === "approve") await approveAgentApplication(s.userId, params.id, b.levelId ? String(b.levelId) : undefined, note);
    else if (action === "reject") await rejectAgentApplication(s.userId, params.id, note);
    else return NextResponse.json({ ok: false, message: "Hành động không hợp lệ" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 400;
    return NextResponse.json({ ok: false, message: String(e?.message ?? "Lỗi xử lý") }, { status });
  }
}
