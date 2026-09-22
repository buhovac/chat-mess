import { parse as parseCookies } from "cookie";
import { verifyToken } from "../lib/jwt.js";
import { canPostMessage, canReadConversation } from "../policies/authorize.js";
import { getMembership, listConversationIdsForUser } from "../modules/conversations/service.js";
import { sendMessageSchema } from "../modules/messages/schema.js";
import { createMessage } from "../modules/messages/service.js";

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
    socket.join(`user:${socket.data.user.id}`);

    // Join every conversation room the user is already a member of, so
    // "message:new" reaches them without any extra client round-trip.
    listConversationIdsForUser(socket.data.user.id)
      .then((conversationIds) => {
        for (const conversationId of conversationIds) {
          socket.join(`conversation:${conversationId}`);
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

    socket.on("disconnect", () => {
      console.log(`socket disconnected: ${socket.id} (user ${socket.data.user.id})`);
    });
  });
}
