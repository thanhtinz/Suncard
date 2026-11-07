import { NextResponse } from "next/server";
import { getSession } from "@/modules/security";
import { prisma } from "@/lib/prisma";

/** Đánh dấu đã đọc toàn bộ thông báo của người dùng (gọi khi mở bảng thông báo ở header). */
export async function POST() {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const r = await prisma.notification.updateMany({
    where: { userId: session.userId, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true, count: r.count });
}
