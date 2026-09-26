import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { errorHandler } from "../../lib/errors.js";
import { setSessionCookie } from "../../lib/session.js";
import { changePlanSchema } from "./schema.js";
import { changePlan } from "./service.js";

const router = Router();

// Demo-only plan switcher (no payment involved) — re-signs the session
// cookie exactly like login/register, since /me and requireAuth both read
// `plan` off the JWT rather than the DB (see requireAuth.js).
router.post("/plan", requireAuth, async (req, res, next) => {
  const parsed = changePlanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } });
  }

  try {
    const user = await changePlan(req.user.id, parsed.data.plan);
    setSessionCookie(res, user);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
});

router.use(errorHandler);

export default router;
