import { prisma } from "./prisma.js";
import { signToken, verifyToken } from "./jwt.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Shared by every route that sets or clears the session cookie (login,
// register, logout, and the account routes) so they can never drift apart
// on maxAge/sameSite/secure.
export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SEVEN_DAYS_MS,
  };
}

// What a service selects when the result is about to be signed into a
// session cookie — tokenVersion included, passwordHash never.
export const SESSION_USER_SELECT = { id: true, email: true, displayName: true, plan: true, tokenVersion: true };

export function toSessionUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    plan: user.plan,
    tokenVersion: user.tokenVersion,
  };
}

// tokenVersion is session plumbing, not profile data: it goes into the JWT
// but never into a JSON response.
export function toPublicUser(user) {
  return { id: user.id, email: user.email, displayName: user.displayName, plan: user.plan };
}

export function setSessionCookie(res, user) {
  const token = signToken(toSessionUser(user));
  res.cookie("token", token, cookieOptions());
}

// maxAge is dropped on purpose: Express 4's clearCookie lets it override
// its own "expires in the past", which would re-set an empty cookie for 7
// days instead of deleting it. The other options must match, or the
// browser treats it as a different cookie and keeps the real one.
export function clearSessionCookie(res) {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie("token", options);
}

// The one place that turns a raw token into "who is this", shared by
// requireAuth (REST) and the Socket.IO handshake. A valid signature is no
// longer enough on its own: the user must still exist (account deletion)
// and the token's tokenVersion must match the DB (password change revokes
// every older session). That costs one primary-key lookup per request.
// Tokens issued before tokenVersion existed carry none — they count as
// version 0, so they stay valid until the first password change, like any
// other pre-change token. Returns null instead of throwing: every caller
// just maps "no user" to 401/unauthorized.
export async function authenticateToken(token) {
  if (!token) return null;

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id }, select: { tokenVersion: true } });
  if (!user || user.tokenVersion !== (payload.tokenVersion ?? 0)) {
    return null;
  }

  // Profile fields still come from the token (see journal 2026-09-26):
  // routes that change them re-sign the cookie.
  return { id: payload.id, email: payload.email, displayName: payload.displayName, plan: payload.plan };
}
