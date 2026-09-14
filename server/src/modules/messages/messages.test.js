import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { signToken } from "../../lib/jwt.js";
import { hashPassword } from "../../lib/password.js";

const emailPrefix = "messages-test-";
const TOTAL_MESSAGES = 60;

let userA;
let userB;
let outsider;
let cookieA;
let cookieOutsider;
let conversationId;

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
  cookieOutsider = cookieFor(outsider);

  const directKey = [userA.id, userB.id].sort().join(":");
  const conversation = await prisma.conversation.create({
    data: {
      type: "DIRECT",
      directKey,
      createdById: userA.id,
      members: { create: [{ userId: userA.id }, { userId: userB.id }] },
    },
  });
  conversationId = conversation.id;

  // Sequential creates so createdAt is strictly increasing — matters for
  // asserting page boundaries below.
  for (let i = 0; i < TOTAL_MESSAGES; i++) {
    await prisma.message.create({
      data: { conversationId, senderId: userA.id, content: `message ${i}` },
    });
  }
});

afterAll(async () => {
  await prisma.conversation.deleteMany({ where: { id: conversationId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: emailPrefix } } });
  await prisma.$disconnect();
});

describe("GET /api/conversations/:id/messages", () => {
  it("returns 404 (not 403) for a non-member", async () => {
    const res = await request(app).get(`/api/conversations/${conversationId}/messages`).set("Cookie", cookieOutsider);
    expect(res.status).toBe(404);
  });

  it("returns the newest 50 messages, oldest-first, when there's no cursor", async () => {
    const res = await request(app).get(`/api/conversations/${conversationId}/messages`).set("Cookie", cookieA);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(50);
    expect(res.body.messages[0].content).toBe("message 10");
    expect(res.body.messages[49].content).toBe("message 59");
    expect(res.body.messages[0].sender).toMatchObject({ id: userA.id, displayName: "User A" });

    const createdAts = res.body.messages.map((m) => m.createdAt);
    const sorted = [...createdAts].sort();
    expect(createdAts).toEqual(sorted);
  });

  it("paginates the next page with `before`, no overlap and no gaps", async () => {
    const firstPage = await request(app).get(`/api/conversations/${conversationId}/messages`).set("Cookie", cookieA);
    const oldestOfFirstPage = firstPage.body.messages[0];

    const secondPage = await request(app)
      .get(`/api/conversations/${conversationId}/messages?before=${oldestOfFirstPage.id}`)
      .set("Cookie", cookieA);

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.messages).toHaveLength(10);
    expect(secondPage.body.messages.map((m) => m.content)).toEqual(
      Array.from({ length: 10 }, (_, i) => `message ${i}`),
    );

    const firstPageIds = new Set(firstPage.body.messages.map((m) => m.id));
    const overlap = secondPage.body.messages.filter((m) => firstPageIds.has(m.id));
    expect(overlap).toHaveLength(0);
  });

  it("400s on a cursor from a different conversation", async () => {
    const otherConversation = await prisma.conversation.create({
      data: {
        type: "DIRECT",
        directKey: [userA.id, outsider.id].sort().join(":"),
        createdById: userA.id,
        members: { create: [{ userId: userA.id }, { userId: outsider.id }] },
      },
    });
    const otherMessage = await prisma.message.create({
      data: { conversationId: otherConversation.id, senderId: userA.id, content: "other" },
    });

    const res = await request(app)
      .get(`/api/conversations/${conversationId}/messages?before=${otherMessage.id}`)
      .set("Cookie", cookieA);

    expect(res.status).toBe(400);

    await prisma.conversation.delete({ where: { id: otherConversation.id } });
  });
});
