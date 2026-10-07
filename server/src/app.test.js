import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import request from "supertest";
import { app } from "./app.js";
import { signToken } from "./lib/jwt.js";
import { errorHandler } from "./lib/errors.js";
import { prisma } from "./lib/prisma.js";

describe("trust proxy", () => {
  it("is set so express-rate-limit and req.ip see the real client IP behind Railway's proxy", () => {
    // Express's own setter for "trust proxy" stores exactly what was passed
    // to app.set() — 1 means "trust exactly one hop", the safe setting for a
    // single reverse proxy in front of the app (as opposed to `true`, which
    // trusts the X-Forwarded-For header from anyone and lets a client spoof
    // its way around IP-based rate limiting).
    expect(app.get("trust proxy")).toBe(1);
  });
});

describe("global error handler", () => {
  it("maps a Prisma P2025 (record not found) that escapes a service to 404 NOT_FOUND", () => {
    // Called directly: the ghost-user JWT this test used to go through is
    // now stopped at requireAuth (401, see below) before any service runs.
    const err = new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "test" });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(404);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error).not.toHaveProperty("stack");
  });
});

describe("requireAuth", () => {
  it("rejects a validly signed token whose user no longer exists (e.g. deleted account)", async () => {
    const cookie = `token=${signToken({
      id: "cknonexistentuserid00",
      email: "ghost@example.com",
      displayName: "Ghost",
      plan: "FREE",
    })}`;

    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  // Every session issued before the tokenVersion migration has no
  // tokenVersion in its payload. It must count as version 0 (still valid
  // after deploy), not as a mismatch (everyone logged out on deploy).
  it("treats a token without tokenVersion (issued before the migration) as version 0", async () => {
    const user = await prisma.user.create({
      data: { email: "legacy-token-test@example.com", passwordHash: "x", displayName: "Legacy" },
    });
    try {
      const legacyPayload = { id: user.id, email: user.email, displayName: user.displayName, plan: user.plan };
      expect(legacyPayload).not.toHaveProperty("tokenVersion");
      const cookie = `token=${signToken(legacyPayload)}`;

      // DB still at the default 0 -> the legacy session survives the deploy.
      expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(200);

      // After a password change (tokenVersion 0 -> 1) the same legacy token is revoked.
      await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: 1 } });
      expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
