import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";

const memberInclude = {
  members: { include: { user: { select: { id: true, displayName: true } } } },
};

function directKeyFor(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join(":");
}

function toConversationDTO(conversation, currentUserId) {
  const otherMember = conversation.members.find((m) => m.userId !== currentUserId);
  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.type === "DIRECT" ? (otherMember?.user.displayName ?? null) : conversation.name,
    members: conversation.members.map((m) => ({ id: m.user.id, displayName: m.user.displayName })),
  };
}

export async function getMembership(conversationId, userId) {
  return prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
}

// Used at socket-connect time to join every room the user is already a
// member of — ids only, no need for the full conversation DTO here.
export async function listConversationIdsForUser(userId) {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true },
  });
  return memberships.map((m) => m.conversationId);
}

export async function getConversationById(conversationId) {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    include: memberInclude,
  });
}

// Single query with includes (members + last message), sorted by last
// activity in JS — Prisma can't order by a related aggregate without raw
// SQL, and this is one round-trip either way (no N+1).
export async function listConversationsForUser(userId) {
  const conversations = await prisma.conversation.findMany({
    where: { members: { some: { userId } } },
    include: {
      ...memberInclude,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return conversations
    .map((conversation) => {
      const lastMessage = conversation.messages[0] ?? null;
      return {
        ...toConversationDTO(conversation, userId),
        lastMessage: lastMessage
          ? { content: lastMessage.content, createdAt: lastMessage.createdAt, senderId: lastMessage.senderId }
          : null,
        activityAt: lastMessage ? lastMessage.createdAt : conversation.createdAt,
      };
    })
    .sort((a, b) => new Date(b.activityAt) - new Date(a.activityAt))
    .map(({ activityAt, ...rest }) => rest);
}

async function findExistingByDirectKey(directKey, currentUserId) {
  const existing = await prisma.conversation.findUnique({
    where: { directKey },
    include: memberInclude,
  });
  return existing ? toConversationDTO(existing, currentUserId) : null;
}

export async function createDirectConversation(currentUserId, otherUserId) {
  if (otherUserId === currentUserId) {
    throw new AppError(422, "INVALID_TARGET", "Cannot start a conversation with yourself");
  }

  const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
  if (!otherUser) {
    throw new AppError(422, "USER_NOT_FOUND", "User does not exist");
  }

  const directKey = directKeyFor(currentUserId, otherUserId);

  const existing = await findExistingByDirectKey(directKey, currentUserId);
  if (existing) {
    return { conversation: existing, created: false };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: { type: "DIRECT", directKey, createdById: currentUserId },
      });
      await tx.conversationMember.createMany({
        data: [
          { conversationId: conversation.id, userId: currentUserId },
          { conversationId: conversation.id, userId: otherUserId },
        ],
      });
      return conversation;
    });

    const full = await prisma.conversation.findUnique({ where: { id: created.id }, include: memberInclude });
    return { conversation: toConversationDTO(full, currentUserId), created: true };
  } catch (err) {
    // Two concurrent POSTs for the same pair can both pass the check above
    // and race the insert — the directKey unique constraint is what actually
    // prevents the duplicate DM; here we just recover the winner's row.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await findExistingByDirectKey(directKey, currentUserId);
      if (winner) {
        return { conversation: winner, created: false };
      }
    }
    throw err;
  }
}

export { toConversationDTO };
