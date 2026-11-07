import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { getSetting } from "./settings";

// ============================================================================
// Passkey / WebAuthn (Phase 4) — @simplewebauthn/server.
// - Challenge sinh ở server, lưu DB ngắn hạn (5 phút), dùng ĐÚNG 1 lần
//   (consume nguyên tử bằng updateMany có điều kiện consumedAt = null).
// - Ba mục đích: REGISTER (thêm passkey trong khu tài khoản), LOGIN (đăng nhập
//   bằng passkey), STEPUP (xác thực lại cho Secure Reveal thay mật khẩu/TOTP).
// - RP ID / origin lấy từ settings webauthn.* (Admin sửa), trống thì suy từ host.
// ============================================================================

export const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export type WebauthnPurpose = "REGISTER" | "LOGIN" | "STEPUP";

export async function rpConfig(req?: Request): Promise<{ rpID: string; rpName: string; expectedOrigin: string }> {
  const rpName = String(await getSetting<string>("webauthn.rp_name", "SunCard"));
  let rpID = String(await getSetting<string>("webauthn.rp_id", ""));
  let expectedOrigin = String(await getSetting<string>("webauthn.expected_origin", ""));
  if (req && (!rpID || !expectedOrigin)) {
    const url = new URL(req.url);
    if (!rpID) rpID = url.hostname;
    if (!expectedOrigin) expectedOrigin = url.origin;
  }
  return { rpID: rpID || "localhost", rpName, expectedOrigin: expectedOrigin || "http://localhost:3000" };
}

async function storeChallenge(purpose: WebauthnPurpose, challenge: string, opts?: { userId?: string; email?: string }) {
  // Dọn challenge cũ đã hết hạn/consumed của cùng mục đích cho gọn bảng.
  await prisma.webAuthnChallenge.deleteMany({ where: { purpose, OR: [{ expiresAt: { lt: new Date() } }, { consumedAt: { not: null } }] } }).catch(() => undefined);
  return prisma.webAuthnChallenge.create({
    data: { challenge, purpose, userId: opts?.userId, email: opts?.email, expiresAt: new Date(Date.now() + WEBAUTHN_CHALLENGE_TTL_MS) },
  });
}

/**
 * Tiêu thụ challenge: chỉ thành công nếu tồn tại, đúng mục đích, chưa dùng, chưa hết hạn.
 * updateMany điều kiện consumedAt=null + expiresAt>now là claim nguyên tử chống dùng 2 lần.
 */
export async function consumeChallenge(challenge: string, purpose: WebauthnPurpose): Promise<boolean> {
  const claim = await prisma.webAuthnChallenge.updateMany({
    where: { challenge, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  return claim.count === 1;
}

/** expectedChallenge dạng callback cho simplewebauthn: kiểm + tiêu thụ trong 1 bước nguyên tử. */
function challengeExpectation(purpose: WebauthnPurpose) {
  return async (challenge: string) => consumeChallenge(challenge, purpose);
}

// ---------------- Đăng ký passkey ----------------
export async function startPasskeyRegistration(user: { id: string; email: string }, req?: Request) {
  const { rpID, rpName } = await rpConfig(req);
  const existing = await prisma.webAuthnCredential.findMany({ where: { userId: user.id } });
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.email,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.credentialId, transports: c.transports ? (JSON.parse(c.transports) as any) : undefined })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred", authenticatorAttachment: "platform" },
  });
  await storeChallenge("REGISTER", options.challenge, { userId: user.id, email: user.email });
  return options;
}

export async function finishPasskeyRegistration(user: { id: string }, response: RegistrationResponseJSON, req?: Request, deviceName?: string) {
  const { rpID, expectedOrigin } = await rpConfig(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeExpectation("REGISTER"),
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (e: any) {
    throw new Error(`WEBAUTHN_VERIFY_FAILED:${String(e?.message ?? e).slice(0, 120)}`);
  }
  if (!verification.verified || !verification.registrationInfo) throw new Error("WEBAUTHN_NOT_VERIFIED");
  const cred = verification.registrationInfo.credential;
  const saved = await prisma.webAuthnCredential.create({
    data: {
      userId: user.id,
      credentialId: cred.id,
      publicKey: isoBase64URL.fromBuffer(cred.publicKey),
      counter: BigInt(cred.counter),
      transports: cred.transports ? JSON.stringify(cred.transports) : null,
      deviceName: deviceName?.slice(0, 80) || "Passkey",
      backedUp: verification.registrationInfo.credentialBackedUp,
    },
  });
  return saved;
}

// ---------------- Đăng nhập bằng passkey ----------------
export async function startPasskeyLogin(email: string, req?: Request) {
  const { rpID } = await rpConfig(req);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  // Không tiết lộ tài khoản có tồn tại hay có passkey hay không: vẫn sinh options rỗng.
  const creds = user ? await prisma.webAuthnCredential.findMany({ where: { userId: user.id } }) : [];
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({ id: c.credentialId, transports: c.transports ? (JSON.parse(c.transports) as any) : undefined })),
    userVerification: "preferred",
  });
  await storeChallenge("LOGIN", options.challenge, { email: email.toLowerCase().trim(), userId: user?.id });
  return options;
}

export async function finishPasskeyLogin(email: string, response: AuthenticationResponseJSON, req?: Request) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) throw new Error("AUTH_INVALID");
  if (user.status !== "ACTIVE") throw new Error("AUTH_INVALID");
  const assertion = await verifyPasskeyAssertion(user.id, response, "LOGIN", req);
  return { user, credentialId: assertion.credentialId, userVerified: assertion.userVerified };
}

// ---------------- Step-up bằng passkey (dùng chung cho LOGIN/STEPUP) ----------------
export async function startPasskeyStepup(userId: string, req?: Request) {
  const { rpID } = await rpConfig(req);
  const creds = await prisma.webAuthnCredential.findMany({ where: { userId } });
  if (creds.length === 0) throw new Error("PASSKEY_NOT_REGISTERED");
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({ id: c.credentialId, transports: c.transports ? (JSON.parse(c.transports) as any) : undefined })),
    userVerification: "preferred",
  });
  await storeChallenge("STEPUP", options.challenge, { userId });
  return options;
}

/** Verify một assertion: credential phải thuộc về user, challenge đúng mục đích + còn hạn + chưa dùng, chữ ký hợp lệ. */
export async function verifyPasskeyAssertion(userId: string, response: AuthenticationResponseJSON, purpose: "LOGIN" | "STEPUP", req?: Request) {
  const { rpID, expectedOrigin } = await rpConfig(req);
  const credId = response.id;
  const stored = await prisma.webAuthnCredential.findUnique({ where: { credentialId: credId } });
  if (!stored || stored.userId !== userId) throw new Error("PASSKEY_UNKNOWN_CREDENTIAL");
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeExpectation(purpose),
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: stored.credentialId,
        publicKey: isoBase64URL.toBuffer(stored.publicKey),
        counter: Number(stored.counter),
        transports: stored.transports ? (JSON.parse(stored.transports) as any) : undefined,
      },
      requireUserVerification: false,
    });
  } catch (e: any) {
    throw new Error(`WEBAUTHN_VERIFY_FAILED:${String(e?.message ?? e).slice(0, 120)}`);
  }
  if (!verification.verified) throw new Error("WEBAUTHN_NOT_VERIFIED");
  await prisma.webAuthnCredential.update({
    where: { id: stored.id },
    data: { counter: BigInt(verification.authenticationInfo.newCounter), lastUsedAt: new Date() },
  });
  return { credentialId: stored.credentialId, newCounter: verification.authenticationInfo.newCounter, userVerified: verification.authenticationInfo.userVerified };
}

export async function listPasskeys(userId: string) {
  return prisma.webAuthnCredential.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true, backedUp: true },
  });
}

export async function deletePasskey(userId: string, id: string) {
  const cred = await prisma.webAuthnCredential.findUnique({ where: { id } });
  if (!cred || cred.userId !== userId) throw new Error("NOT_FOUND");
  await prisma.webAuthnCredential.delete({ where: { id } });
  return cred;
}
