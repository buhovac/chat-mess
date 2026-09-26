import { prisma } from "../../lib/prisma.js";

export async function changePlan(userId, plan) {
  return prisma.user.update({
    where: { id: userId },
    data: { plan },
    select: { id: true, email: true, displayName: true, plan: true },
  });
}
