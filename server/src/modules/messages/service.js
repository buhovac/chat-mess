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
    include: { sender: { select: { id: true, displayName: true, plan: true } } },
  });

  // Fetched newest-first so the cursor lands on the right page; the API
  // contract is oldest-first (so the client can just append to the top).
  return messages.reverse().map(toMessageDto);
}

// The one place a Message row becomes API output, so REST history, socket
// events and attachment uploads can't drift apart. The stored R2 key is
// never exposed: clients get a same-origin URL that re-checks membership.
export function toMessageDto(message) {
  return {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt,
    kind: message.kind,
    sender: message.sender
      ? { id: message.sender.id, displayName: message.sender.displayName, plan: message.sender.plan }
      : null,
    attachmentUrl: message.attachmentUrl ? `/api/attachments/${message.id}` : null,
    attachmentType: message.attachmentType,
    attachmentName: message.attachmentName,
    attachmentSize: message.attachmentSize,
  };
}

// Shared by the Socket.IO "message:send" handler and the attachment upload
// route so the create path only exists once. attachment is
// { key, type, name, size } when present.
export async function createMessage(conversationId, senderId, content, attachment = null) {
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content,
      ...(attachment
        ? {
            attachmentUrl: attachment.key,
            attachmentType: attachment.type,
            attachmentName: attachment.name,
            attachmentSize: attachment.size,
          }
        : {}),
    },
    include: { sender: { select: { id: true, displayName: true, plan: true } } },
  });

  return toMessageDto(message);
}

// For GET /api/attachments/:messageId: just what the route needs to check
// membership and stream the file.
export function findAttachment(messageId) {
  return prisma.message.findFirst({
    where: { id: messageId, attachmentUrl: { not: null } },
    select: { conversationId: true, attachmentUrl: true, attachmentType: true, attachmentName: true },
  });
}
