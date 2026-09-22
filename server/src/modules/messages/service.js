import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";

// Cursor-based (not offset): correct even if messages are inserted between
// two page fetches, and cheap regardless of how deep the history is.
export async function listMessages(conversationId, { before, limit = 50 } = {}) {
  if (before) {
    const cursorMessage = await prisma.message.findUnique({ where: { id: before } });
    if (!cursorMessage || cursorMessage.conversationId !== conversationId) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid pagination cursor");
    }
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    // createdAt alone isn't a total order — two messages can land in the same
    // millisecond, and Postgres then breaks the tie arbitrarily. id (cuid,
    // roughly time-ordered but always unique) makes pagination boundaries
    // deterministic even then.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    ...(before ? { cursor: { id: before }, skip: 1 } : {}),
    include: { sender: { select: { id: true, displayName: true } } },
  });

  // Fetched newest-first so the cursor lands on the right page; the API
  // contract is oldest-first (so the client can just append to the top).
  return messages.reverse().map((message) => ({
    id: message.id,
    content: message.content,
    createdAt: message.createdAt,
    kind: message.kind,
    sender: message.sender ? { id: message.sender.id, displayName: message.sender.displayName } : null,
  }));
}

// Shared by the Socket.IO "message:send" handler (and any future REST POST)
// so the create path only exists once.
export async function createMessage(conversationId, senderId, content) {
  const message = await prisma.message.create({
    data: { conversationId, senderId, content },
    include: { sender: { select: { id: true, displayName: true } } },
  });

  return {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt,
    kind: message.kind,
    sender: { id: message.sender.id, displayName: message.sender.displayName },
  };
}
