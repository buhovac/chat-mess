import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { loadMembership } from "../../middleware/loadMembership.js";
import { errorHandler, AppError } from "../../lib/errors.js";
import {
  canReadConversation,
  canAddMember,
  canRemoveMember,
  canChangeRole,
  canRename,
  canLeave,
  canDeleteConversation,
} from "../../policies/authorize.js";
import {
  createConversationSchema,
  addMemberSchema,
  changeRoleSchema,
  renameConversationSchema,
  leaveConversationSchema,
} from "./schema.js";
import {
  listConversationsForUser,
  createDirectConversation,
  createGroupConversation,
  getConversationById,
  getMembership,
  countMembers,
  addMember,
  removeMember,
  changeRole,
  renameConversation,
  leaveConversation,
  transferOwnershipAndLeave,
  deleteConversation,
  toConversationDTO,
} from "./service.js";
import { joinConversationRooms, leaveConversationRoom } from "../../sockets/index.js";

const router = Router();

// Tests run against the bare Express app (see conversations.test.js /
// groups.test.js), which has no live Socket.IO server attached — every
// call site below guards on this instead of assuming `io` exists.
function getIo(req) {
  return req.app.get("io") ?? null;
}

function emitSystemMessage(io, conversationId, systemMessage) {
  if (!io || !systemMessage) return;
  io.to(`conversation:${conversationId}`).emit("message:new", { conversationId, message: systemMessage });
}

// Shared by "remove member" and "leave" (self-removal): tells the removed
// user's own sockets to drop the room and pops a toast/navigate on their
// client, then actually moves their sockets out of the room.
function notifyMemberRemoved(io, conversationId, userId) {
  if (!io) return;
  io.to(`user:${userId}`).emit("conversation:removed", { conversationId });
  leaveConversationRoom(io, userId, conversationId);
}

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
    if (parsed.data.type === "DIRECT") {
      const { conversation, created } = await createDirectConversation(req.user.id, parsed.data.userId);
      return res.status(created ? 201 : 200).json({ conversation });
    }

    const { conversation, systemMessage } = await createGroupConversation(
      req.user.id,
      parsed.data.name,
      parsed.data.memberIds,
    );

    const io = getIo(req);
    const memberIds = conversation.members.map((m) => m.id);
    if (io) {
      joinConversationRooms(io, memberIds, conversation.id);
      io.to(memberIds.map((id) => `user:${id}`)).emit("conversation:new", { conversation });
      emitSystemMessage(io, conversation.id, systemMessage);
    }

    res.status(201).json({ conversation });
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

router.patch("/:id", requireAuth, loadMembership, async (req, res, next) => {
  const parsed = renameConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } });
  }

  try {
    if (!req.conversation) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found" } });
    }
    if (!canRename(req.membership)) {
      return res.status(req.membership ? 403 : 404).json({
        error: { code: req.membership ? "FORBIDDEN" : "NOT_FOUND", message: "Cannot rename this conversation" },
      });
    }

    const { name, systemMessage } = await renameConversation(req.params.id, req.user.id, parsed.data.name);

    const io = getIo(req);
    if (io) {
      io.to(`conversation:${req.params.id}`).emit("conversation:updated", { conversationId: req.params.id, name });
      emitSystemMessage(io, req.params.id, systemMessage);
    }

    res.status(200).json({ name });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, loadMembership, async (req, res, next) => {
  try {
    if (!req.conversation) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found" } });
    }
    if (!canDeleteConversation(req.membership)) {
      return res.status(req.membership ? 403 : 404).json({
        error: { code: req.membership ? "FORBIDDEN" : "NOT_FOUND", message: "Cannot delete this conversation" },
      });
    }

    const { memberIds } = await deleteConversation(req.params.id);

    const io = getIo(req);
    if (io) {
      for (const memberId of memberIds) {
        notifyMemberRemoved(io, req.params.id, memberId);
      }
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post("/:id/members", requireAuth, loadMembership, async (req, res, next) => {
  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } });
  }

  try {
    if (!req.conversation) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found" } });
    }
    if (!canAddMember(req.membership)) {
      return res.status(req.membership ? 403 : 404).json({
        error: { code: req.membership ? "FORBIDDEN" : "NOT_FOUND", message: "Cannot add members to this conversation" },
      });
    }

    const { member, systemMessage } = await addMember(req.params.id, req.user.id, parsed.data.userId);

    const io = getIo(req);
    if (io) {
      joinConversationRooms(io, [member.id], req.params.id);
      io.to(`conversation:${req.params.id}`).emit("member:added", { conversationId: req.params.id, member });

      // The new member wasn't in the conversation room a moment ago, so the
      // broadcast above never reached them — they need their own
      // "a conversation now exists" event, from their own perspective
      // (myRole: MEMBER), so their sidebar picks it up.
      const fullConversation = await getConversationById(req.params.id);
      io.to(`user:${member.id}`).emit("conversation:new", {
        conversation: toConversationDTO(fullConversation, member.id),
      });

      emitSystemMessage(io, req.params.id, systemMessage);
    }

    res.status(201).json({ member });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/members/:userId", requireAuth, loadMembership, async (req, res, next) => {
  try {
    if (!req.conversation) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found" } });
    }

    const targetMembership = await getMembership(req.params.id, req.params.userId);
    const target = targetMembership ? { ...targetMembership, conversationType: req.conversation.type } : null;

    if (!canRemoveMember(req.membership, target)) {
      return res.status(req.membership ? 403 : 404).json({
        error: { code: req.membership ? "FORBIDDEN" : "NOT_FOUND", message: "Cannot remove this member" },
      });
    }

    const { member, systemMessage } = await removeMember(req.params.id, req.user.id, req.params.userId);

    const io = getIo(req);
    if (io) {
      io.to(`conversation:${req.params.id}`).emit("member:removed", { conversationId: req.params.id, member });
      emitSystemMessage(io, req.params.id, systemMessage);
      notifyMemberRemoved(io, req.params.id, req.params.userId);
    }

    res.status(200).json({ member });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/members/:userId", requireAuth, loadMembership, async (req, res, next) => {
  const parsed = changeRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } });
  }

  try {
    if (!req.conversation) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found" } });
    }

    const targetMembership = await getMembership(req.params.id, req.params.userId);
    const target = targetMembership ? { ...targetMembership, conversationType: req.conversation.type } : null;

    if (!canChangeRole(req.membership, target, parsed.data.role)) {
      return res.status(req.membership ? 403 : 404).json({
        error: { code: req.membership ? "FORBIDDEN" : "NOT_FOUND", message: "Cannot change this member's role" },
      });
    }

    const { member, systemMessage } = await changeRole(req.params.id, req.user.id, req.params.userId, parsed.data.role);

    const io = getIo(req);
    if (io) {
      io.to(`conversation:${req.params.id}`).emit("member:role_changed", { conversationId: req.params.id, member });
      emitSystemMessage(io, req.params.id, systemMessage);
    }

    res.status(200).json({ member });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/leave", requireAuth, loadMembership, async (req, res, next) => {
  const parsed = leaveConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } });
  }

  try {
    if (!req.conversation || !req.membership || req.membership.conversationType !== "GROUP") {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found" } });
    }

    const memberCount = await countMembers(req.params.id);
    const io = getIo(req);

    if (canLeave(req.membership, memberCount)) {
      const result = await leaveConversation(req.params.id, req.user.id, memberCount);

      if (result.deleted) {
        if (io) notifyMemberRemoved(io, req.params.id, req.user.id);
        return res.status(204).end();
      }

      if (io) {
        io.to(`conversation:${req.params.id}`).emit("member:removed", {
          conversationId: req.params.id,
          member: { id: req.user.id },
        });
        emitSystemMessage(io, req.params.id, result.systemMessage);
        notifyMemberRemoved(io, req.params.id, req.user.id);
      }
      return res.status(200).json({ left: true });
    }

    // canLeave() returned false: the only way that happens for a valid
    // GROUP membership is OWNER with other members still present — the
    // conversation needs a new OWNER before this one can leave.
    const { transferTo } = parsed.data;
    if (!transferTo) {
      throw new AppError(422, "TRANSFER_REQUIRED", "Assign an owner before leaving (transferTo)");
    }
    const transferTarget = await getMembership(req.params.id, transferTo);
    if (!transferTarget || transferTo === req.user.id) {
      throw new AppError(422, "VALIDATION_ERROR", "transferTo must be another member of this conversation");
    }

    const { systemMessage } = await transferOwnershipAndLeave(req.params.id, req.user.id, transferTo);

    if (io) {
      io.to(`conversation:${req.params.id}`).emit("member:role_changed", {
        conversationId: req.params.id,
        member: { id: transferTo, role: "OWNER" },
      });
      io.to(`conversation:${req.params.id}`).emit("member:removed", {
        conversationId: req.params.id,
        member: { id: req.user.id },
      });
      emitSystemMessage(io, req.params.id, systemMessage);
      notifyMemberRemoved(io, req.params.id, req.user.id);
    }

    res.status(200).json({ left: true, newOwnerId: transferTo });
  } catch (err) {
    next(err);
  }
});

router.use(errorHandler);

export default router;
