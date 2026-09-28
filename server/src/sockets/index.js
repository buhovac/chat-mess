import { parse as parseCookies } from "cookie";
import { verifyToken } from "../lib/jwt.js";
import { canPostMessage, canReadConversation } from "../policies/authorize.js";
import { getMembership, listConversationIdsForUser, markConversationRead } from "../modules/conversations/service.js";
import { sendMessageSchema } from "../modules/messages/schema.js";
import { createMessage } from "../modules/messages/service.js";
import { addSocket, removeSocket } from "./presence.js";
import { consumeMessageToken } from "./rateLimiter.js";

// Socket.IO handshakes don't go through Express middleware, so the cookie
// header has to be parsed by hand here instead of reusing cookie-parser.
function authenticateSocket(socket, next) {
  const rawCookie = socket.handshake.headers.cookie;
  const token = rawCookie ? parseCookies(rawCookie).token : undefined;

  if (!token) {
    return next(new Error("unauthorized"));
  }

  try {
    const payload = verifyToken(token);
    socket.data.user = { id: payload.id, email: payload.email, displayName: payload.displayName, plan: payload.plan };
    next();
  } catch {
    next(new Error("unauthorized"));
  }
}

// Called from REST routes (not just socket handlers) whenever membership
// changes outside of a socket event — e.g. a group is created, or someone
// is added — so every affected user's *already-connected* sockets pick up
// the new room without waiting for a reconnect. socketsJoin/socketsLeave
// operate on rooms directly (here, each user's own `user:<id>` room) and
// are synchronous no-ops if that user has no live socket right now.
export function joinConversationRooms(io, userIds, conversationId) {
  for (const userId of userIds) {
    io.in(`user:${userId}`).socketsJoin(`conversation:${conversationId}`);
  }
}

export function leaveConversationRoom(io, userId, conversationId) {
  io.in(`user:${userId}`).socketsLeave(`conversation:${conversationId}`);
}

export function registerSocketHandlers(io) {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const userId = socket.data.user.id;
    socket.join(`user:${userId}`);

    // Only the user's *first* socket flips them online — a second tab/device
    // connecting shouldn't re-announce "online" to everyone.
    const cameOnline = addSocket(userId, socket.id);

    // Join every conversation room the user is already a member of, so
    // "message:new" reaches them without any extra client round-trip. Also
    // where we learn which rooms to announce presence to, since that's
    // exactly "every conversation this user is in".
    listConversationIdsForUser(userId)
      .then((conversationIds) => {
        for (const conversationId of conversationIds) {
          socket.join(`conversation:${conversationId}`);
          if (cameOnline) {
            io.to(`conversation:${conversationId}`).emit("presence:update", { userId, online: true });
          }
        }
      })
      .catch((err) => console.error("failed to join conversation rooms", err));

    // Fast path for a conversation created *after* connect (e.g. just
    // started from the "new conversation" dialog): the client asks to join
    // once it knows the id, we just re-check membership before allowing it.
    socket.on("conversation:join", async ({ conversationId } = {}, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        const membership = await getMembership(conversationId, socket.data.user.id);
        if (!canReadConversation(socket.data.user, membership)) {
          return reply({ ok: false, error: { code: "FORBIDDEN", message: "Not a member of this conversation" } });
        }
        socket.join(`conversation:${conversationId}`);
        reply({ ok: true });
      } catch (err) {
        console.error(err);
        reply({ ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
      }
    });

    socket.on("message:send", async ({ conversationId, content, clientTempId } = {}, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        if (!consumeMessageToken(userId)) {
          return reply({ ok: false, error: { code: "RATE_LIMITED", message: "Too many messages, slow down" } });
        }

        const parsed = sendMessageSchema.safeParse({ content });
        if (!parsed.success) {
          return reply({
            ok: false,
            error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0].message },
          });
        }

        const membership = await getMembership(conversationId, socket.data.user.id);
        if (!canPostMessage(socket.data.user, membership)) {
          return reply({ ok: false, error: { code: "FORBIDDEN", message: "Not a member of this conversation" } });
        }

        const message = await createMessage(conversationId, socket.data.user.id, parsed.data.content);

        io.to(`conversation:${conversationId}`).emit("message:new", { conversationId, message, clientTempId });
        reply({ ok: true, message });
      } catch (err) {
        console.error(err);
        reply({ ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
      }
    });

    // Socket counterpart of POST /:id/read — same service call, same
    // "own room only" emit, just reachable without a REST round-trip while
    // the conversation is already open.
    socket.on("conversation:read", async ({ conversationId } = {}, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        const membership = await getMembership(conversationId, userId);
        if (!canReadConversation(socket.data.user, membership)) {
          return reply({ ok: false, error: { code: "FORBIDDEN", message: "Not a member of this conversation" } });
        }

        const { lastReadAt } = await markConversationRead(conversationId, userId);
        io.to(`user:${userId}`).emit("conversation:read", { conversationId, lastReadAt });
        reply({ ok: true, lastReadAt });
      } catch (err) {
        console.error(err);
        reply({ ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
      }
    });

    // Typing is fire-and-forget (no ack) — worst case on an error or a
    // non-member trying it is silence, not a broken UI.
    async function broadcastTyping(event, conversationId) {
      try {
        const membership = await getMembership(conversationId, userId);
        if (!canReadConversation(socket.data.user, membership)) return;
        socket.to(`conversation:${conversationId}`).emit(event, { conversationId, userId });
      } catch (err) {
        console.error(err);
      }
    }

    socket.on("typing:start", ({ conversationId } = {}) => broadcastTyping("typing:start", conversationId));
    socket.on("typing:stop", ({ conversationId } = {}) => broadcastTyping("typing:stop", conversationId));

    socket.on("disconnect", () => {
      const wentOffline = removeSocket(userId, socket.id);
      if (wentOffline) {
        listConversationIdsForUser(userId)
          .then((conversationIds) => {
            for (const conversationId of conversationIds) {
              io.to(`conversation:${conversationId}`).emit("presence:update", { userId, online: false });
            }
          })
          .catch((err) => console.error("failed to broadcast presence offline", err));
      }
      console.log(`socket disconnected: ${socket.id} (user ${userId})`);
    });
  });
}
