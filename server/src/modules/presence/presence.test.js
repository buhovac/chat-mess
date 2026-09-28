import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { signToken } from "../../lib/jwt.js";
import { hashPassword } from "../../lib/password.js";
import { addSocket, removeSocket } from "../../sockets/presence.js";

const emailPrefix = "presence-test-";

let onlineUser;
let offlineUser;
let cookie;

beforeAll(async () => {
  const passwordHash = await hashPassword("password123");

  [onlineUser, offlineUser] = await Promise.all([
    prisma.user.create({ data: { email: `${emailPrefix}online@example.com`, passwordHash, displayName: "Online User" } }),
    prisma.user.create({ data: { email: `${emailPrefix}offline@example.com`, passwordHash, displayName: "Offline User" } }),
  ]);

  cookie = `token=${signToken({
    id: onlineUser.id,
    email: onlineUser.email,
    displayName: onlineUser.displayName,
    plan: onlineUser.plan,
  })}`;

  // Simulates onlineUser having a live socket, without spinning up a real
  // Socket.IO server — presence.js's Map is the single source of truth
  // either way, so exercising it directly is enough to unit-test the route.
  addSocket(onlineUser.id, "fake-socket-id");
});

afterAll(async () => {
  removeSocket(onlineUser.id, "fake-socket-id");
  await prisma.user.deleteMany({ where: { email: { startsWith: emailPrefix } } });
  await prisma.$disconnect();
});

describe("GET /api/presence", () => {
  it("requires authentication", async () => {
    const res = await request(app).get(`/api/presence?ids=${onlineUser.id}`);
    expect(res.status).toBe(401);
  });

  it("reports online/offline correctly for a mix of ids", async () => {
    const res = await request(app).get(`/api/presence?ids=${onlineUser.id},${offlineUser.id}`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.presence).toEqual({ [onlineUser.id]: true, [offlineUser.id]: false });
  });

  it("400s on a malformed id", async () => {
    const res = await request(app).get("/api/presence?ids=not-a-cuid").set("Cookie", cookie);
    expect(res.status).toBe(400);
  });
});
