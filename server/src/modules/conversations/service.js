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
  const myMembership = conversation.members.find((m) => m.userId === currentUserId);
  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.type === "DIRECT" ? (otherMember?.user.displayName ?? null) : conversation.name,
    members: conversation.members.map((m) => ({ id: m.user.id, displayName: m.user.displayName, role: m.role })),
    memberCount: conversation.members.length,
    // What the client uses to decide which member-management buttons to show
    // (a UX hint only — every mutation route re-checks with authorize.js).
    myRole: myMembership?.role ?? null,
  };
}

// Shared by every group mutation below: one system message per mutation,
// written in the same transaction as the mutation itself so the log entry
// never exists without the change it describes (or vice versa). Takes a
// Prisma client so callers can pass either `prisma` or a `tx`.
async function createSystemMessage(client, conversationId, content) {
  const message = await client.message.create({
    data: { conversationId, senderId: null, kind: "SYSTEM", content },
  });
  return { id: message.id, content: message.content, createdAt: message.createdAt, kind: message.kind, sender: null };
}

async function displayNameOf(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
  return user?.displayName ?? "Quelqu'un";
}

export async function getMembership(conversationId, userId) {
  return prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
}

export async function countMembers(conversationId) {
  return prisma.conversationMember.count({ where: { conversationId } });
}

export async function listMemberIds(conversationId) {
  const rows = await prisma.conversationMember.findMany({ where: { conversationId }, select: { userId: true } });
  return rows.map((r) => r.userId);
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

// memberIds is "other" members chosen in the UI — the creator becomes OWNER
// automatically and isn't in that list. Dedupe (and drop the creator's own
// id if they picked themselves by mistake) before enforcing the >=3-total
// rule, so `[b, b]` or `[creator, b]` can't sneak a 2-person group past it.
export async function createGroupConversation(currentUserId, name, memberIds) {
  const otherIds = [...new Set(memberIds)].filter((id) => id !== currentUserId);
  if (otherIds.length < 2) {
    throw new AppError(422, "VALIDATION_ERROR", "A group needs at least 3 members in total");
  }

  const existingUsers = await prisma.user.findMany({ where: { id: { in: otherIds } }, select: { id: true } });
  if (existingUsers.length !== otherIds.length) {
    throw new AppError(422, "USER_NOT_FOUND", "One or more users do not exist");
  }

  const creatorName = await displayNameOf(currentUserId);

  const { conversationId, systemMessage } = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: { type: "GROUP", name, createdById: currentUserId },
    });
    await tx.conversationMember.createMany({
      data: [
        { conversationId: conversation.id, userId: currentUserId, role: "OWNER" },
        ...otherIds.map((userId) => ({ conversationId: conversation.id, userId, role: "MEMBER" })),
      ],
    });
    const message = await createSystemMessage(tx, conversation.id, `${creatorName} a créé le groupe « ${name} »`);
    return { conversationId: conversation.id, systemMessage: message };
  });

  const full = await prisma.conversation.findUnique({ where: { id: conversationId }, include: memberInclude });
  return { conversation: toConversationDTO(full, currentUserId), systemMessage };
}

export async function addMember(conversationId, actorUserId, targetUserId) {
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { displayName: true } });
  if (!targetUser) {
    throw new AppError(422, "USER_NOT_FOUND", "User does not exist");
  }

  const existingMembership = await getMembership(conversationId, targetUserId);
  if (existingMembership) {
    throw new AppError(422, "ALREADY_MEMBER", "User is already a member of this conversation");
  }

  const actorName = await displayNameOf(actorUserId);

  const systemMessage = await prisma.$transaction(async (tx) => {
    await tx.conversationMember.create({ data: { conversationId, userId: targetUserId, role: "MEMBER" } });
    return createSystemMessage(tx, conversationId, `${actorName} a ajouté ${targetUser.displayName}`);
  });

  return { member: { id: targetUserId, displayName: targetUser.displayName, role: "MEMBER" }, systemMessage };
}

export async function removeMember(conversationId, actorUserId, targetUserId) {
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { displayName: true } });
  const actorName = await displayNameOf(actorUserId);

  const systemMessage = await prisma.$transaction(async (tx) => {
    await tx.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId: targetUserId } } });
    return createSystemMessage(tx, conversationId, `${actorName} a retiré ${targetUser?.displayName ?? "un membre"}`);
  });

  return { member: { id: targetUserId, displayName: targetUser?.displayName ?? null }, systemMessage };
}

const ROLE_LABELS = { ADMIN: "administrateur", MEMBER: "membre" };

export async function changeRole(conversationId, actorUserId, targetUserId, newRole) {
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { displayName: true } });
  const actorName = await displayNameOf(actorUserId);

  const systemMessage = await prisma.$transaction(async (tx) => {
    await tx.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: targetUserId } },
      data: { role: newRole },
    });
    return createSystemMessage(
      tx,
      conversationId,
      `${actorName} a changé le rôle de ${targetUser?.displayName ?? "un membre"} en ${ROLE_LABELS[newRole]}`,
    );
  });

  return { member: { id: targetUserId, displayName: targetUser?.displayName ?? null, role: newRole }, systemMessage };
}

export async function renameConversation(conversationId, actorUserId, name) {
  const actorName = await displayNameOf(actorUserId);

  const systemMessage = await prisma.$transaction(async (tx) => {
    await tx.conversation.update({ where: { id: conversationId }, data: { name } });
    return createSystemMessage(tx, conversationId, `${actorName} a renommé le groupe en « ${name} »`);
  });

  return { name, systemMessage };
}

// The "plain leave" path: canLeave() in authorize.js already ruled out the
// one case this can't handle (OWNER with others remaining — that goes
// through transferOwnershipAndLeave instead). memberCount is passed in
// rather than re-queried since the caller (the route handler) already has
// it from the canLeave() check.
export async function leaveConversation(conversationId, actorUserId, memberCount) {
  const actorName = await displayNameOf(actorUserId);

  if (memberCount <= 1) {
    // The last member leaving would otherwise orphan an empty GROUP in the
    // DB forever — same cleanup as an explicit delete.
    await prisma.conversation.delete({ where: { id: conversationId } });
    return { deleted: true };
  }

  const systemMessage = await prisma.$transaction(async (tx) => {
    await tx.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId: actorUserId } } });
    return createSystemMessage(tx, conversationId, `${actorName} a quitté le groupe`);
  });

  return { deleted: false, systemMessage };
}

export async function transferOwnershipAndLeave(conversationId, actorUserId, transferToUserId) {
  const [actorName, newOwner] = await Promise.all([
    displayNameOf(actorUserId),
    prisma.user.findUnique({ where: { id: transferToUserId }, select: { displayName: true } }),
  ]);

  const systemMessage = await prisma.$transaction(async (tx) => {
    await tx.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: transferToUserId } },
      data: { role: "OWNER" },
    });
    await tx.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId: actorUserId } } });
    return createSystemMessage(
      tx,
      conversationId,
      `${actorName} a quitté le groupe, ${newOwner?.displayName ?? "un membre"} est maintenant propriétaire`,
    );
  });

  return { deleted: false, systemMessage };
}

export async function deleteConversation(conversationId) {
  const memberIds = await listMemberIds(conversationId);
  await prisma.conversation.delete({ where: { id: conversationId } });
  return { memberIds };
}

export { toConversationDTO };
