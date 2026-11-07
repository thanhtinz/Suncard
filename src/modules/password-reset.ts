import { prisma } from "@/lib/prisma";
import { randomToken, sha256Hex } from "@/lib/crypto";

// ACC-09: token reset mật khẩu dùng MỘT lần, hạn 30 phút, chỉ lưu hash.
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomToken(32);
  await prisma.verificationRecord.updateMany({ where: { userId, type: "PASSWORD_RESET", status: "PENDING" }, data: { status: "SUPERSEDED" } });
  await prisma.verificationRecord.create({
    data: { userId, type: "PASSWORD_RESET", codeHash: sha256Hex(token), status: "PENDING", expiresAt: new Date(Date.now() + 30 * 60000) },
  });
  return token;
}

export async function consumePasswordResetToken(token: string) {
  const record = await prisma.verificationRecord.findFirst({
    where: { type: "PASSWORD_RESET", codeHash: sha256Hex(token), status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (!record || !record.expiresAt || record.expiresAt < new Date()) throw new Error("VALIDATION_EXPIRED");
  await prisma.verificationRecord.update({ where: { id: record.id }, data: { status: "USED", verifiedAt: new Date() } });
  return record;
}
