import { PrismaClient } from "@prisma/client";

// Singleton: every module imports this same instance instead of opening its
// own connection pool (Prisma opens one per PrismaClient() call).
export const prisma = new PrismaClient();
