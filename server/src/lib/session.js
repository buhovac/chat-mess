import { signToken } from "./jwt.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Shared by every route that sets or clears the session cookie (login,
// register, logout, and the account/plan demo switcher) so they can never
// drift apart on maxAge/sameSite/secure.
export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SEVEN_DAYS_MS,
  };
}

export function setSessionCookie(res, user) {
  const token = signToken({ id: user.id, email: user.email, displayName: user.displayName, plan: user.plan });
  res.cookie("token", token, cookieOptions());
}
