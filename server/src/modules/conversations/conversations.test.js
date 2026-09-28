import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { signToken } from "../../lib/jwt.js";
import { hashPassword } from "../../lib/password.js";

const emailPrefix = "conversations-test-";

let userA;
let userB;
let outsider;
let cookieA;
let cookieB;
let cookieOutsider;

function cookieFor(user) {
  return `token=${signToken({ id: user.id, email: user.email, displayName: user.displayName, plan: user.plan })}`;
}

beforeAll(async () => {
  const passwordHash = await hashPassword("password123");

  [userA, userB, outsider] = await Promise.all([
    prisma.user.create({ data: { email: `${emailPrefix}a@example.com`, passwordHash, displayName: "User A" } }),
    prisma.user.create({ data: { email: `${emailPrefix}b@example.com`, passwordHash, displayName: "User B" } }),
    prisma.user.create({ data: { email: `${emailPrefix}outsider@example.com`, passwordHash, displayName: "Outsider" } }),
  ]);

  cookieA = cookieFor(userA);
  cookieB = cookieFor(userB);
  cookieOutsider = cookieFor(outsider);
});

afterAll(async () => {
  await prisma.conversation.deleteMany({ where: { members: { some: { userId: { in: [userA.id, userB.id] } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: emailPrefix } } });
  await prisma.$disconnect();
});

describe("POST /api/conversations", () => {
  it("creates a DIRECT conversation between the two members", async () => {
    const res = await request(app)
      .post("/api/conversations")
      .set("Cookie", cookieA)
      .send({ type: "DIRECT", userId: userB.id });

    expect(res.status).toBe(201);
    expect(res.body.conversation.type).toBe("DIRECT");
    expect(res.body.conversation.name).toBe("User B");
    expect(res.body.conversation.members.map((m) => m.id).sort()).toEqual([userA.id, userB.id].sort());
  });

  it("returns the same conversation (200, no duplicate) on a second call with the same pair", async () => {
    const first = await request(app)
      .post("/api/conversations")
      .set("Cookie", cookieA)
      .send({ type: "DIRECT", userId: userB.id });

    const second = await request(app)
      .post("/api/conversations")
      .set("Cookie", cookieA)
      .send({ type: "DIRECT", userId: userB.id });

    expect(second.status).toBe(200);
    expect(second.body.conversation.id).toBe(first.body.conversation.id);

    const count = await prisma.conversation.count({ where: { directKey: [userA.id, userB.id].sort().join(":") } });
    expect(count).toBe(1);
  });

  it("422s when the target user does not exist", async () => {
    const res = await request(app)
      .post("/api/conversations")
      .set("Cookie", cookieA)
      .send({ type: "DIRECT", userId: "cknonexistentuserid00" });

    expect(res.status).toBe(422);
  });

  it("422s when the target user is the current user", async () => {
    const res = await request(app)
      .post("/api/conversations")
      .set("Cookie", cookieA)
      .send({ type: "DIRECT", userId: userA.id });

    expect(res.status).toBe(422);
  });
});

describe("GET /api/conversations/:id", () => {
  it("returns 404 (not 403) for a non-member", async () => {
    const created = await request(app)
      .post("/api/conversations")
      .set("Cookie", cookieA)
      .send({ type: "DIRECT", userId: userB.id });

    const res = await request(app).get(`/api/conversations/${created.body.conversation.id}`).set("Cookie", cookieOutsider);

    expect(res.status).toBe(404);
  });

  it("returns the conversation for a member", async () => {
    const created = await request(app)
      .post("/api/conversations")
      .set("Cookie", cookieA)
      .send({ type: "DIRECT", userId: userB.id });

    const res = await request(app).get(`/api/conversations/${created.body.conversation.id}`).set("Cookie", cookieA);

    expect(res.status).toBe(200);
    expect(res.body.conversation.id).toBe(created.body.conversation.id);
  });

  it("returns 404 for a conversation id that doesn't exist", async () => {
    const res = await request(app).get("/api/conversations/cknonexistentconvid0").set("Cookie", cookieA);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/conversations", () => {
  it("lists the current user's conversations", async () => {
    await request(app).post("/api/conversations").set("Cookie", cookieA).send({ type: "DIRECT", userId: userB.id });

    const res = await request(app).get("/api/conversations").set("Cookie", cookieA);

    expect(res.status).toBe(200);
    expect(res.body.conversations.some((c) => c.name === "User B")).toBe(true);
  });
});

describe("unread counts + POST /:id/read", () => {
  it("excludes the caller's own messages, counts the others', and zeroes out after marking read", async () => {
    const created = await request(app)
      .post("/api/conversations")
      .set("Cookie", cookieA)
      .send({ type: "DIRECT", userId: userB.id });
    const conversationId = created.body.conversation.id;

    // B sends two, A replies with one — from A's point of view that's 2
    // unread (B's), and from B's point of view, 1 unread (A's reply, sent
    // after B's own messages).
    await prisma.message.create({ data: { conversationId, senderId: userB.id, content: "hi 1" } });
    await prisma.message.create({ data: { conversationId, senderId: userB.id, content: "hi 2" } });
    await prisma.message.create({ data: { conversationId, senderId: userA.id, content: "reply" } });

    async function unreadFor(cookie) {
      const res = await request(app).get("/api/conversations").set("Cookie", cookie);
      return res.body.conversations.find((c) => c.id === conversationId).unreadCount;
    }

    expect(await unreadFor(cookieA)).toBe(2);
    expect(await unreadFor(cookieB)).toBe(1);

    const readRes = await request(app).post(`/api/conversations/${conversationId}/read`).set("Cookie", cookieA);
    expect(readRes.status).toBe(200);

    expect(await unreadFor(cookieA)).toBe(0);
    // Marking A's copy as read must not affect B's own unread count.
    expect(await unreadFor(cookieB)).toBe(1);
  });

  it("404s marking read a conversation the caller isn't a member of", async () => {
    const created = await request(app)
      .post("/api/conversations")
      .set("Cookie", cookieA)
      .send({ type: "DIRECT", userId: userB.id });

    const res = await request(app)
      .post(`/api/conversations/${created.body.conversation.id}/read`)
      .set("Cookie", cookieOutsider);

    expect(res.status).toBe(404);
  });
});
