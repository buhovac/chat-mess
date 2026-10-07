import { Router } from "express";
import { registerSchema, loginSchema } from "./schema.js";
import { registerUser, loginUser } from "./service.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { passwordRateLimit } from "../../middleware/rateLimits.js";
import { clearSessionCookie, setSessionCookie, toPublicUser } from "../../lib/session.js";

const router = Router();

router.post("/register", passwordRateLimit, async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } });
  }

  try {
    const user = await registerUser(parsed.data);
    setSessionCookie(res, user);
    res.status(201).json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/login", passwordRateLimit, async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } });
  }

  try {
    const user = await loginUser(parsed.data);
    setSessionCookie(res, user);
    res.status(200).json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});

export default router;
