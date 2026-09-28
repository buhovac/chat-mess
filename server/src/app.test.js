import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./app.js";
import { signToken } from "./lib/jwt.js";

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
  it("maps a Prisma P2025 (record not found) that escapes a service to 404 NOT_FOUND", async () => {
    // A JWT for a user id that was never created (or was deleted after the
    // session was issued) — account/service.js's prisma.user.update() then
    // throws P2025, which no route catches explicitly, so this only 404s if
    // the global handler in lib/errors.js is actually wired up.
    const cookie = `token=${signToken({
      id: "cknonexistentuserid00",
      email: "ghost@example.com",
      displayName: "Ghost",
      plan: "FREE",
    })}`;

    const res = await request(app).post("/api/account/plan").set("Cookie", cookie).send({ plan: "PRO" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error).not.toHaveProperty("stack");
  });
});
