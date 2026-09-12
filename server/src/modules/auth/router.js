import { Router } from "express";
import rateLimit from "express-rate-limit";
import { registerSchema, loginSchema } from "./schema.js";
import { registerUser, loginUser } from "./service.js";
import { signToken } from "../../lib/jwt.js";
import { requireAuth } from "../../middleware/requireAuth.js";

const router = Router();

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SEVEN_DAYS_MS,
  };
}

function setSessionCookie(res, user) {
  const token = signToken({ id: user.id, email: user.email, displayName: user.displayName, plan: user.plan });
  res.cookie("token", token, cookieOptions());
}

router.post("/register", authRateLimit, async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } });
  }

  try {
    const user = await registerUser(parsed.data);
    setSessionCookie(res, user);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

router.post("/login", authRateLimit, async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } });
  }

  try {
    const user = await loginUser(parsed.data);
    setSessionCookie(res, user);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token", cookieOptions());
  res.status(200).json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});

// Central error handler for this router: AuthError instances carry their own
// status/code, anything else is an unexpected bug (500, no stack leaked).
router.use((err, _req, res, _next) => {
  if (err.status) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
});

export default router;
