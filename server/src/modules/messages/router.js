import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { errorHandler } from "../../lib/errors.js";
import { canReadConversation } from "../../policies/authorize.js";
import { getMembership } from "../conversations/service.js";
import { listMessagesQuerySchema } from "./schema.js";
import { listMessages } from "./service.js";

// mergeParams: this router is mounted at /api/conversations/:id/messages —
// without it, Express wouldn't pass the parent's :id into req.params here.
const router = Router({ mergeParams: true });

router.get("/", requireAuth, async (req, res, next) => {
  const parsed = listMessagesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } });
  }

  try {
    const conversationId = req.params.id;
    const membership = await getMembership(conversationId, req.user.id);

    // 404, never 403: a non-member must not learn the conversation exists.
    if (!canReadConversation(req.user, membership)) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found" } });
    }

    const messages = await listMessages(conversationId, parsed.data);
    res.status(200).json({ messages });
  } catch (err) {
    next(err);
  }
});

router.use(errorHandler);

export default router;
