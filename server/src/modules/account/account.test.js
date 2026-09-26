import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../app.js";
import { prisma } from "../../lib/prisma.js";

// Real Postgres (docker-compose "db"), not mocked — see CLAUDE.md testing rules.
const testEmail = "account-plan-test@example.com";
const testPassword = "password123";

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
});

describe("POST /api/account/plan", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(app).post("/api/account/plan").send({ plan: "PRO" });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid plan value with 400", async () => {
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ email: testEmail, password: testPassword, displayName: "Plan Test User" });
    const cookie = registerRes.headers["set-cookie"][0];

    const res = await request(app).post("/api/account/plan").set("Cookie", cookie).send({ plan: "GOLD" });
    expect(res.status).toBe(400);
  });

  it("switches the plan, persists it, and refreshes the session cookie", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: testPassword });
    const cookie = loginRes.headers["set-cookie"][0];

    const res = await request(app).post("/api/account/plan").set("Cookie", cookie).send({ plan: "PRO" });

    expect(res.status).toBe(200);
    expect(res.body.user.plan).toBe("PRO");
    expect(res.headers["set-cookie"][0]).toMatch(/^token=/);

    const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(dbUser.plan).toBe("PRO");

    // The refreshed cookie should reflect the new plan immediately, without
    // needing to log in again.
    const newCookie = res.headers["set-cookie"][0];
    const meRes = await request(app).get("/api/auth/me").set("Cookie", newCookie);
    expect(meRes.body.user.plan).toBe("PRO");
  });
});
