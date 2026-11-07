import { NextResponse } from "next/server";
import { getSession } from "@/modules/security";
import { listSavedBanks, createSavedBank, MAX_SAVED_BANKS, type SavedBankAccountRow } from "@/modules/saved-banks";

function pub(b: SavedBankAccountRow) {
  return { id: b.id, bankName: b.bankName, accountNumber: b.accountNumber, accountName: b.accountName, isDefault: b.isDefault };
}

/** Danh sách ngân hàng đã lưu của chính người dùng (mặc định lên đầu). */
export async function GET() {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, message: "Chưa đăng nhập" }, { status: 401 });
  const banks = await listSavedBanks(session.userId);
  return NextResponse.json({ ok: true, banks: banks.map(pub) });
}

/** Thêm ngân hàng đã lưu. Ngân hàng đầu tiên (hoặc khi tick chọn) thành mặc định. */
export async function POST(req: Request) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, message: "Chưa đăng nhập" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const bankName = String(b.bankName ?? "").trim();
  const accountNumber = String(b.accountNumber ?? "").replace(/[\s.]/g, "");
  const accountName = String(b.accountName ?? "").trim();
  if (!bankName || bankName.length > 100) return NextResponse.json({ ok: false, message: "Vui lòng nhập tên ngân hàng." }, { status: 400 });
  if (!/^[0-9]{6,24}$/.test(accountNumber)) return NextResponse.json({ ok: false, message: "Số tài khoản phải gồm 6–24 chữ số." }, { status: 400 });
  if (!accountName || accountName.length > 100) return NextResponse.json({ ok: false, message: "Vui lòng nhập tên chủ tài khoản." }, { status: 400 });
  try {
    const bank = await createSavedBank(session.userId, { bankName, accountNumber, accountName, isDefault: !!b.isDefault });
    return NextResponse.json({ ok: true, bank: pub(bank) }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "TOO_MANY_BANKS") {
      return NextResponse.json({ ok: false, message: `Bạn đã lưu tối đa ${MAX_SAVED_BANKS} ngân hàng.` }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: "Không lưu được ngân hàng. Vui lòng thử lại." }, { status: 400 });
  }
}
