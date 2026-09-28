import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { presenceQuerySchema } from "./schema.js";
import { getPresence } from "./service.js";

const router = Router();

router.get("/", requireAuth, (req, res) => {
  const parsed = presenceQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } });
  }

  res.status(200).json({ presence: getPresence(parsed.data.ids) });
});

export default router;
