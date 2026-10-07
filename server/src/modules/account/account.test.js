import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { hashPassword } from "../../lib/password.js";

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

// Session cookie straight from a fresh login, the way a browser would have it.
async function loginCookie(email, password) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.headers["set-cookie"][0];
}

describe("PATCH /api/account/profile", () => {
  const email = "account-profile-test@example.com";
  let cookie;

  beforeAll(async () => {
    await prisma.user.create({
      data: { email, passwordHash: await hashPassword(testPassword), displayName: "Before Rename" },
    });
    cookie = await loginCookie(email, testPassword);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  it.each([
    ["blank after trim", "   "],
    ["over 100 characters", "x".repeat(101)],
  ])("rejects a displayName that is %s with 400", async (_label, displayName) => {
    const res = await request(app).patch("/api/account/profile").set("Cookie", cookie).send({ displayName });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("renames the user and the new name is in the session immediately (new cookie, not just the DB)", async () => {
    const res = await request(app)
      .patch("/api/account/profile")
      .set("Cookie", cookie)
      .send({ displayName: "  After Rename  " });

    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe("After Rename");
    expect(res.body.user).not.toHaveProperty("tokenVersion");

    const newCookie = res.headers["set-cookie"][0];
    expect(newCookie).toMatch(/^token=/);
    const meRes = await request(app).get("/api/auth/me").set("Cookie", newCookie);
    expect(meRes.body.user.displayName).toBe("After Rename");
  });
});

describe("POST /api/account/password", () => {
  const email = "account-password-test@example.com";
  const newPassword = "new-password-456";
  let cookie;

  beforeAll(async () => {
    await prisma.user.create({
      data: { email, passwordHash: await hashPassword(testPassword), displayName: "Password Test" },
    });
    cookie = await loginCookie(email, testPassword);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  it("rejects a newPassword over 128 characters with 400 (bcrypt DoS bound)", async () => {
    const res = await request(app)
      .post("/api/account/password")
      .set("Cookie", cookie)
      .send({ currentPassword: testPassword, newPassword: "x".repeat(129) });
    expect(res.status).toBe(400);
  });

  it("rejects a wrong currentPassword with 401 and changes nothing", async () => {
    const before = await prisma.user.findUnique({ where: { email } });

    const res = await request(app)
      .post("/api/account/password")
      .set("Cookie", cookie)
      .send({ currentPassword: "wrong-password", newPassword });

    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: "INVALID_CREDENTIALS", message: "Invalid credentials" });
    const after = await prisma.user.findUnique({ where: { email } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.tokenVersion).toBe(before.tokenVersion);
  });

  it("changes the password: new one logs in, old one doesn't, and older sessions are revoked", async () => {
    const res = await request(app)
      .post("/api/account/password")
      .set("Cookie", cookie)
      .send({ currentPassword: testPassword, newPassword });

    expect(res.status).toBe(200);

    // The session that made the change stays logged in with its re-signed cookie...
    const refreshedCookie = res.headers["set-cookie"][0];
    expect((await request(app).get("/api/auth/me").set("Cookie", refreshedCookie)).status).toBe(200);
    // ...while the cookie issued before the change (another device, say) is dead.
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);

    const oldLogin = await request(app).post("/api/auth/login").send({ email, password: testPassword });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post("/api/auth/login").send({ email, password: newPassword });
    expect(newLogin.status).toBe(200);
  });
});
