import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { signToken } from "../../lib/jwt.js";
import { hashPassword } from "../../lib/password.js";

const emailPrefix = "users-test-";

let me;
let cookie;

beforeAll(async () => {
  const passwordHash = await hashPassword("password123");

  me = await prisma.user.create({
    data: { email: `${emailPrefix}me@example.com`, passwordHash, displayName: "Search Self" },
  });

  await prisma.user.createMany({
    data: [
      { email: `${emailPrefix}alice@example.com`, passwordHash, displayName: "Alice Dupont" },
      { email: `${emailPrefix}bob@example.com`, passwordHash, displayName: "Bob Martin" },
    ],
  });

  cookie = `token=${signToken({ id: me.id, email: me.email, displayName: me.displayName, plan: me.plan })}`;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: emailPrefix } } });
  await prisma.$disconnect();
});

describe("GET /api/users", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/users?q=alice");
    expect(res.status).toBe(401);
  });

  it("finds a match by displayName, case-insensitive, excluding self", async () => {
    const res = await request(app).get("/api/users?q=DUPONT").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].displayName).toBe("Alice Dupont");
    expect(res.body.users.some((u) => u.id === me.id)).toBe(false);
  });

  it("finds a match by email", async () => {
    const res = await request(app).get(`/api/users?q=${emailPrefix}bob`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.users.map((u) => u.displayName)).toContain("Bob Martin");
  });

  it("returns all users except me, sorted by displayName, for an empty query", async () => {
    const res = await request(app).get("/api/users?q=").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.users.map((u) => u.displayName)).toContain("Alice Dupont");
    expect(res.body.users.map((u) => u.displayName)).toContain("Bob Martin");
    expect(res.body.users.some((u) => u.id === me.id)).toBe(false);
    const names = res.body.users.map((u) => u.displayName);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("caps the empty-query result at MAX_RESULTS", async () => {
    const passwordHash = await hashPassword("password123");
    await prisma.user.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        email: `${emailPrefix}cap-${i}@example.com`,
        passwordHash,
        displayName: `Cap User ${String(i).padStart(2, "0")}`,
      })),
    });

    const res = await request(app).get("/api/users?q=").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(20);
  });
});
