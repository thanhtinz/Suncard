import { prisma } from "@/lib/prisma";
import { fail, readJson, serialize } from "@/lib/api";
import { hashPassword, SESSION_COOKIE, createSessionForUser } from "@/modules/security";
import { ensureWallet, type DB } from "@/modules/ledger";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const { email, password, fullName, phone } = body;
    if (!email || !password || String(password).length < 8) throw new Error("VALIDATION_PASSWORD_MIN_8");
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error("DUPLICATE_REQUEST");
    const customerRole = await prisma.role.findUnique({ where: { code: "CUSTOMER" } });
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email, phone, passwordHash: await hashPassword(password), kycStatus: "NONE" } });
      await tx.userProfile.create({ data: { userId: u.id, fullName: fullName || email.split("@")[0] } });
      if (customerRole) await tx.userRole.create({ data: { userId: u.id, roleId: customerRole.id } });
      await ensureWallet(tx as DB, u.id);
      return u;
    });
    const { token } = await createSessionForUser(user, ["CUSTOMER"], null, {});
    const res = NextResponse.json({ data: serialize({ id: user.id, email: user.email }), request_id: "req" }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 86400 });
    return res;
  } catch (e) { return fail(e); }
}
