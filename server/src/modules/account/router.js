import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { passwordRateLimit } from "../../middleware/rateLimits.js";
import { clearSessionCookie, setSessionCookie, toPublicUser } from "../../lib/session.js";
import { emitSystemMessage } from "../../sockets/index.js";
import { changePasswordSchema, changePlanSchema, deleteAccountSchema, updateProfileSchema } from "./schema.js";
import { changePassword, changePlan, deleteAccount, updateProfile } from "./service.js";

const router = Router();

// Tests run against the bare Express app with no Socket.IO server attached
// (same guard as conversations/router.js).
function getIo(req) {
  return req.app.get("io") ?? null;
}

function validationError(res, parsed) {
  return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message } });
}

// Demo-only plan switcher (no payment involved) — re-signs the session
// cookie exactly like login/register, since /me and requireAuth both read
// `plan` off the JWT rather than the DB (see lib/session.js).
router.post("/plan", requireAuth, async (req, res, next) => {
  const parsed = changePlanSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);

  try {
    const user = await changePlan(req.user.id, parsed.data.plan);
    setSessionCookie(res, user);
    res.status(200).json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

// displayName lives in the JWT too — same re-sign as /plan, otherwise /me
// would keep returning the old name until the next login.
router.patch("/profile", requireAuth, async (req, res, next) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);

  try {
    const user = await updateProfile(req.user.id, parsed.data);
    setSessionCookie(res, user);
    res.status(200).json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/password", passwordRateLimit, requireAuth, async (req, res, next) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);

  try {
    const user = await changePassword(req.user.id, parsed.data);
    // tokenVersion was just bumped, which invalidated this session's cookie
    // along with all the others — re-sign it so the user who made the
    // change stays logged in here.
    setSessionCookie(res, user);

    // Live sockets authenticated at handshake time with the old token; drop
    // them so a revoked session can't keep receiving messages. The client
    // that made the change reconnects right away with its new cookie.
    getIo(req)?.in(`user:${req.user.id}`).disconnectSockets(true);

    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/", passwordRateLimit, requireAuth, async (req, res, next) => {
  const parsed = deleteAccountSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed);

  try {
    const userId = req.user.id;
    const departures = await deleteAccount(userId, parsed.data.currentPassword);

    const io = getIo(req);
    if (io) {
      for (const { conversationId, deleted, systemMessage, newOwnerId } of departures) {
        if (deleted) continue; // nobody else was in it — nobody to tell
        const room = `conversation:${conversationId}`;
        // Sent here rather than left to the "disconnect" handler: by the
        // time that runs, the memberships are gone, so it would find no
        // room to announce "offline" to.
        io.to(room).emit("presence:update", { userId, online: false });
        if (newOwnerId) {
          io.to(room).emit("member:role_changed", { conversationId, member: { id: newOwnerId, role: "OWNER" } });
        }
        io.to(room).emit("member:removed", { conversationId, member: { id: userId } });
        emitSystemMessage(io, conversationId, systemMessage);
      }
      io.in(`user:${userId}`).disconnectSockets(true);
    }

    clearSessionCookie(res);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
