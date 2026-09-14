import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { errorHandler } from "../../lib/errors.js";
import { canReadConversation } from "../../policies/authorize.js";
import { createConversationSchema } from "./schema.js";
import { listConversationsForUser, createDirectConversation, getConversationById, toConversationDTO } from "./service.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const conversations = await listConversationsForUser(req.user.id);
    res.status(200).json({ conversations });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  const parsed = createConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } });
  }

  try {
    const { conversation, created } = await createDirectConversation(req.user.id, parsed.data.userId);
    res.status(created ? 201 : 200).json({ conversation });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const conversation = await getConversationById(req.params.id);
    const membership = conversation?.members.find((m) => m.userId === req.user.id);

    // 404, never 403: a non-member must not learn the conversation exists.
    if (!conversation || !canReadConversation(req.user, membership)) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found" } });
    }

    res.status(200).json({ conversation: toConversationDTO(conversation, req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.use(errorHandler);

export default router;
