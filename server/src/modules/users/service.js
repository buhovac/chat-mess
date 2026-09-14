import { prisma } from "../../lib/prisma.js";

const MAX_RESULTS = 20;

export async function searchUsers({ query, excludeUserId }) {
  if (!query) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      id: { not: excludeUserId },
      OR: [
        { displayName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, displayName: true, email: true },
    orderBy: { displayName: "asc" },
    take: MAX_RESULTS,
  });
}
