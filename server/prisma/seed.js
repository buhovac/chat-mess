// Dev/demo data only — never run against production (Railway's `start`
// script only runs `migrate deploy`, not this file).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_PASSWORD = "password123";

const users = [
  { email: "camille.martin@example.com", displayName: "Camille Martin" },
  { email: "lucas.bernard@example.com", displayName: "Lucas Bernard" },
  { email: "manon.dubois@example.com", displayName: "Manon Dubois" },
];

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  for (const user of users) {
    // upsert: re-running `npm run prisma:seed` after a `migrate reset` stays safe.
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, passwordHash },
    });
  }

  console.log(`Seeded ${users.length} users (password: "${SEED_PASSWORD}")`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
