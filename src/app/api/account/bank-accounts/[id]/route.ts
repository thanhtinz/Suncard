import { NextResponse } from "next/server";
import { getSession } from "@/modules/security";
import { deleteSavedBank, setDefaultSavedBank } from "@/modules/saved-banks";

/** Đặt một ngân hàng đã lưu làm mặc định (chỉ của chính người dùng). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, message: "Chưa đăng nhập" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.isDefault !== true) return NextResponse.json({ ok: false, message: "Chỉ hỗ trợ đặt làm mặc định." }, { status: 400 });
  const bank = await setDefaultSavedBank(session.userId, params.id);
  if (!bank) return NextResponse.json({ ok: false, message: "Không tìm thấy ngân hàng đã lưu" }, { status: 404 });
  return NextResponse.json({ ok: true, bank: { id: bank.id, bankName: bank.bankName, accountNumber: bank.accountNumber, accountName: bank.accountName, isDefault: bank.isDefault } });
}

/** Xoá một ngân hàng đã lưu (chỉ của chính người dùng). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, message: "Chưa đăng nhập" }, { status: 401 });
  const removed = await deleteSavedBank(session.userId, params.id);
  if (!removed) return NextResponse.json({ ok: false, message: "Không tìm thấy ngân hàng đã lưu" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
