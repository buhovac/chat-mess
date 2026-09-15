import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../app.js";
import { prisma } from "../../lib/prisma.js";

// Real Postgres (docker-compose "db"), not mocked — see CLAUDE.md testing rules.
const testEmail = "auth-test@example.com";
const testPassword = "password123";

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
});

describe("POST /api/auth/register", () => {
  it("creates the user and sets the session cookie", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: testEmail, password: testPassword, displayName: "Test User" });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: testEmail, displayName: "Test User" });
    expect(res.headers["set-cookie"][0]).toMatch(/^token=/);
  });

  it("rejects a duplicate email with 409", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: testEmail, password: testPassword, displayName: "Test User" });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  it("rejects a wrong password with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: "wrong-password" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without a cookie", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 200 with a valid session cookie", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: testPassword });

    const cookie = loginRes.headers["set-cookie"][0];

    const meRes = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(testEmail);
  });
});
