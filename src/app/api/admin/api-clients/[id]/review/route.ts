import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/modules/security";
import { approveApiClient, rejectApiClient, setApiClientStatus } from "@/modules/api-applications";

/** Duyệt / từ chối / khoá / mở lại kết nối API của người dùng. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const s = await requireAuth();
    await requirePermission(s, "clients.manage");
    const b = await req.json().catch(() => ({}));
    const action = String(b.action ?? "");
    const note = b.note ? String(b.note) : undefined;
    if (action === "approve") await approveApiClient(s.userId, params.id, note);
    else if (action === "reject") await rejectApiClient(s.userId, params.id, note);
    else if (action === "suspend") await setApiClientStatus(s.userId, params.id, "SUSPENDED", note);
    else if (action === "activate") await setApiClientStatus(s.userId, params.id, "ACTIVE", note);
    else return NextResponse.json({ ok: false, message: "Hành động không hợp lệ" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 400;
    return NextResponse.json({ ok: false, message: String(e?.message ?? "Lỗi xử lý") }, { status });
  }
}
