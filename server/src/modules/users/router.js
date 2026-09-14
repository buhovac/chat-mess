import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { errorHandler } from "../../lib/errors.js";
import { searchUsersQuerySchema } from "./schema.js";
import { searchUsers } from "./service.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  const parsed = searchUsersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } });
  }

  try {
    const users = await searchUsers({ query: parsed.data.q, excludeUserId: req.user.id });
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
});

router.use(errorHandler);

export default router;
