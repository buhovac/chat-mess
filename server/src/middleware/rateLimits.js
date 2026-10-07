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
