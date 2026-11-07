import { prisma } from "@/lib/prisma";
import { ok, fail, readJson } from "@/lib/api";
import { createPasswordResetToken } from "@/modules/password-reset";
import { logAudit, notifyUser } from "@/modules/audit";
import type { DB } from "@/modules/ledger";

// Quên mật khẩu: response LUÔN giống nhau (không tiết lộ email tồn tại — ACC-04).
// Token chỉ gửi qua kênh khôi phục; môi trường dev trả kèm token để demo/kiểm chứng.
export async function POST(req: Request) {
  try {
    const { email } = await readJson(req);
    const user = email ? await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } }) : null;
    let devToken: string | undefined;
    if (user) {
      devToken = await createPasswordResetToken(user.id);
      await notifyUser(prisma as unknown as DB, { userId: user.id, type: "PASSWORD_RESET_REQUESTED", title: "Yêu cầu đặt lại mật khẩu", body: "Một yêu cầu đặt lại mật khẩu vừa được tạo. Token có hạn 30 phút và chỉ dùng 1 lần. Nếu không phải bạn, hãy bỏ qua và kiểm tra phiên đăng nhập.", resourceType: "USER", resourceId: user.id });
      await logAudit(prisma as unknown as DB, { actorId: user.id, action: "PASSWORD_RESET_REQUESTED", entityType: "USER", entityId: user.id, result: "SUCCESS" });
    }
    return ok({ message: "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.", ...(process.env.NODE_ENV !== "production" && devToken ? { dev_token: devToken } : {}) });
  } catch (e) { return fail(e); }
}
