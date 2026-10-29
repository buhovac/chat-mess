import rateLimit from "express-rate-limit";

// Strict per-IP limit for every route that runs bcrypt on a user-supplied
// password (login, register, password change, account deletion). One shared
// instance on purpose: they all count against the same budget, so spreading
// guesses across several of these routes doesn't buy an attacker more tries.
export const passwordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// Uploads cost real storage and bandwidth, so they get their own, tighter
// budget than the global /api limit. Keyed by user id (this always runs
// after requireAuth), not IP: one abusive account can't hide behind
// rotating IPs, and colleagues behind the same office NAT don't share a quota.
export const attachmentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
});
