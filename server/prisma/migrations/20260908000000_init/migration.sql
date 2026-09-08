-- Initial placeholder migration (matches prisma/schema.prisma).
-- Étape 2 replaces the placeholder model with the real MVP schema via
-- `prisma migrate dev --name init_mvp` — never edit this file after it has
-- been applied somewhere; add a new migration instead.

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);
