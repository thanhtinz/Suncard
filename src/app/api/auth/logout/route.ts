import { SESSION_COOKIE, getSession, revokeSession } from "@/modules/security";
import { NextResponse } from "next/server";
export async function POST(req: Request) {
  const session = await getSession().catch(() => null);
  if (session?.sid) await revokeSession(session.sid).catch(() => undefined);
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
