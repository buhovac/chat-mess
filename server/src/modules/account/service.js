import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { comparePassword, hashPassword } from "../../lib/password.js";
import { SESSION_USER_SELECT } from "../../lib/session.js";
import { departAllConversations } from "../conversations/service.js";

export async function changePlan(userId, plan) {
  return prisma.user.update({
    where: { id: userId },
    data: { plan },
    select: SESSION_USER_SELECT,
  });
}

export async function updateProfile(userId, { displayName }) {
  return prisma.user.update({
    where: { id: userId },
    data: { displayName },
    select: SESSION_USER_SELECT,
  });
}

// Gate for both irreversible-ish actions below. Same code and message as a
// failed login, and no hint about which field was wrong.
async function verifyCurrentPassword(userId, currentPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, displayName: true } });
  if (!user || !(await comparePassword(currentPassword, user.passwordHash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");
  }
  return user;
}

// Bumping tokenVersion revokes every session issued before this change
// (other devices, a stolen cookie) — authenticateToken compares it on each
// request. The caller re-signs the cookie of the session that made the
// change, so that one stays logged in.
export async function changePassword(userId, { currentPassword, newPassword }) {
  await verifyCurrentPassword(userId, currentPassword);
  const passwordHash = await hashPassword(newPassword);
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash, tokenVersion: { increment: 1 } },
    select: SESSION_USER_SELECT,
  });
}

// One transaction: the user leaves every conversation (system messages,
// ownership transfers, cleanup of conversations they were last in), then
// the User row goes. Their past messages survive with senderId = null
// (Message.sender is onDelete: SetNull). Either all of it happens or none.
// The timeout is raised from Prisma's 5s default because the work grows
// with the number of conversations the user is in.
export async function deleteAccount(userId, currentPassword) {
  const { displayName } = await verifyCurrentPassword(userId, currentPassword);

  return prisma.$transaction(
    async (tx) => {
      const departures = await departAllConversations(tx, userId, displayName);
      await tx.user.delete({ where: { id: userId } });
      return departures;
    },
    { timeout: 15_000 },
  );
}
