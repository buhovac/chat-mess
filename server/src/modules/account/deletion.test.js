import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as ioClient } from "socket.io-client";
import request from "supertest";
import { app } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { signToken } from "../../lib/jwt.js";
import { hashPassword } from "../../lib/password.js";
import { registerSocketHandlers } from "../../sockets/index.js";
import { pickSuccessorOwner } from "../conversations/service.js";

// Real Postgres + a real Socket.IO server attached to the app (like
// src/index.js does), since deletion has to be checked from the remaining
// members' point of view, live sockets included.
const emailPrefix = "account-deletion-test-";
const password = "password123";

let httpServer;
let io;
let port;
let alice; // the one who deletes her account
let bob;
let carol;
let groupId; // Alice OWNER, Carol MEMBER (joined first), Bob ADMIN
let soloGroupId; // Alice is the only member left
let directId; // Alice <-> Bob
const openSockets = [];

function cookieFor(user) {
  return `token=${signToken({ id: user.id, email: user.email, displayName: user.displayName, plan: user.plan })}`;
}

function connectAs(user) {
  const socket = ioClient(`http://localhost:${port}`, {
    extraHeaders: { Cookie: cookieFor(user) },
    reconnection: false,
    forceNew: true,
  });
  openSockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);
  });
}

beforeAll(async () => {
  httpServer = createServer();
  io = new Server(httpServer);
  registerSocketHandlers(io);
  app.set("io", io);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  port = httpServer.address().port;

  const passwordHash = await hashPassword(password);
  [alice, bob, carol] = await Promise.all(
    ["Alice", "Bob", "Carol"].map((name) =>
      prisma.user.create({ data: { email: `${emailPrefix}${name.toLowerCase()}@example.com`, passwordHash, displayName: name } }),
    ),
  );

  // Explicit joinedAt: Carol joined before Bob, so "oldest ADMIN" (Bob)
  // and "oldest member" (Carol) are different people — the test can tell
  // which rule actually picked the new owner.
  const group = await prisma.conversation.create({
    data: {
      type: "GROUP",
      name: "Deletion group",
      createdById: alice.id,
      members: {
        create: [
          { userId: alice.id, role: "OWNER", joinedAt: new Date("2026-01-01") },
          { userId: carol.id, role: "MEMBER", joinedAt: new Date("2026-01-02") },
          { userId: bob.id, role: "ADMIN", joinedAt: new Date("2026-01-03") },
        ],
      },
      messages: { create: [{ senderId: alice.id, content: "group message from Alice" }] },
    },
  });
  groupId = group.id;

  const soloGroup = await prisma.conversation.create({
    data: {
      type: "GROUP",
      name: "Alice alone",
      createdById: alice.id,
      members: { create: [{ userId: alice.id, role: "OWNER" }] },
    },
  });
  soloGroupId = soloGroup.id;

  const direct = await prisma.conversation.create({
    data: {
      type: "DIRECT",
      directKey: [alice.id, bob.id].sort().join(":"),
      createdById: alice.id,
      members: { create: [{ userId: alice.id }, { userId: bob.id }] },
      messages: {
        create: [
          { senderId: alice.id, content: "dm from Alice", createdAt: new Date("2026-02-01") },
          { senderId: bob.id, content: "dm from Bob", createdAt: new Date("2026-02-02") },
        ],
      },
    },
  });
  directId = direct.id;
});

afterAll(async () => {
  for (const socket of openSockets) socket.close();
  app.set("io", null);
  io.close();
  httpServer.close();
  await prisma.conversation.deleteMany({ where: { id: { in: [groupId, soloGroupId, directId] } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: emailPrefix } } });
  await prisma.$disconnect();
});

describe("pickSuccessorOwner", () => {
  const member = (userId, role, day) => ({ userId, role, joinedAt: new Date(`2026-01-0${day}`) });

  it("prefers the longest-standing ADMIN over an older MEMBER", () => {
    const successor = pickSuccessorOwner([member("m1", "MEMBER", 1), member("a2", "ADMIN", 3), member("a1", "ADMIN", 2)]);
    expect(successor.userId).toBe("a1");
  });

  it("falls back to the longest-standing member when there is no ADMIN", () => {
    expect(pickSuccessorOwner([member("m2", "MEMBER", 2), member("m1", "MEMBER", 1)]).userId).toBe("m1");
  });

  it("returns null when nobody is left", () => {
    expect(pickSuccessorOwner([])).toBeNull();
  });
});

describe("DELETE /api/account", () => {
  it("rejects a wrong currentPassword with 401 and deletes nothing", async () => {
    const res = await request(app).delete("/api/account").set("Cookie", cookieFor(alice)).send({ currentPassword: "nope-nope" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(await prisma.user.findUnique({ where: { id: alice.id } })).not.toBeNull();
    expect(await prisma.conversationMember.count({ where: { userId: alice.id } })).toBe(3);
  });

  it("rejects a missing currentPassword with 400", async () => {
    const res = await request(app).delete("/api/account").set("Cookie", cookieFor(alice)).send({});
    expect(res.status).toBe(400);
  });

  describe("with the right password", () => {
    let res;
    let aliceDisconnectReason;
    const bobEvents = [];

    beforeAll(async () => {
      const [aliceSocket, bobSocket] = await Promise.all([connectAs(alice), connectAs(bob)]);
      // Rooms are joined asynchronously right after connect (DB lookup).
      await new Promise((resolve) => setTimeout(resolve, 100));

      const aliceDisconnected = new Promise((resolve) => aliceSocket.once("disconnect", resolve));
      for (const event of ["message:new", "member:removed", "member:role_changed", "presence:update"]) {
        bobSocket.on(event, (payload) => bobEvents.push({ event, payload }));
      }

      res = await request(app).delete("/api/account").set("Cookie", cookieFor(alice)).send({ currentPassword: password });
      aliceDisconnectReason = await aliceDisconnected;
      // Let Bob's events arrive.
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it("deletes the user and clears the session cookie", async () => {
      expect(res.status).toBe(204);
      expect(await prisma.user.findUnique({ where: { id: alice.id } })).toBeNull();

      const setCookie = res.headers["set-cookie"][0];
      expect(setCookie).toMatch(/^token=;/);
      expect(setCookie).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(setCookie).not.toMatch(/Max-Age/);
    });

    it("disconnects Alice's live socket from the server side", () => {
      // "io server disconnect" = kicked by the server; socket.io-client
      // doesn't auto-reconnect after that, unlike a network drop.
      expect(aliceDisconnectReason).toBe("io server disconnect");
    });

    it("refuses Alice's old cookie (REST and socket) even though its signature is still valid", async () => {
      expect((await request(app).get("/api/auth/me").set("Cookie", cookieFor(alice))).status).toBe(401);
      await expect(connectAs(alice)).rejects.toThrow("unauthorized");
    });

    it("GROUP: keeps her old messages as 'deleted user', adds a SYSTEM message, hands ownership to the oldest ADMIN", async () => {
      const messagesRes = await request(app).get(`/api/conversations/${groupId}/messages`).set("Cookie", cookieFor(bob));
      const { messages } = messagesRes.body;

      const old = messages.find((m) => m.content === "group message from Alice");
      expect(old.sender).toBeNull(); // rendered "Utilisateur supprimé" by MessageList
      expect(old.kind).toBe("TEXT");

      const last = messages.at(-1);
      expect(last.kind).toBe("SYSTEM");
      expect(last.content).toBe("Alice a supprimé son compte, Bob est maintenant propriétaire");

      const members = await prisma.conversationMember.findMany({ where: { conversationId: groupId } });
      expect(members.map((m) => [m.userId, m.role]).sort()).toEqual(
        [
          [bob.id, "OWNER"],
          [carol.id, "MEMBER"],
        ].sort(),
      );
    });

    it("GROUP where she was the last member: the conversation is deleted", async () => {
      expect(await prisma.conversation.findUnique({ where: { id: soloGroupId } })).toBeNull();
    });

    it("DIRECT: survives for Bob with full history, a SYSTEM message, and recipientGone", async () => {
      const listRes = await request(app).get("/api/conversations").set("Cookie", cookieFor(bob));
      const dm = listRes.body.conversations.find((c) => c.id === directId);
      expect(dm).toMatchObject({ type: "DIRECT", memberCount: 1, recipientGone: true });

      const { messages } = (await request(app).get(`/api/conversations/${directId}/messages`).set("Cookie", cookieFor(bob))).body;
      expect(messages.map((m) => [m.content, m.sender?.id ?? null])).toEqual([
        ["dm from Alice", null],
        ["dm from Bob", bob.id],
        ["Alice a supprimé son compte", null],
      ]);
      expect(messages.at(-1).kind).toBe("SYSTEM");
    });

    it("DIRECT: Bob can no longer send into it (no recipient)", async () => {
      const bobSocket = await connectAs(bob);
      const ack = await new Promise((resolve) => {
        bobSocket.emit("message:send", { conversationId: directId, content: "are you there?" }, resolve);
      });

      expect(ack.ok).toBe(false);
      expect(ack.error.code).toBe("RECIPIENT_GONE");
      expect(await prisma.message.count({ where: { conversationId: directId, content: "are you there?" } })).toBe(0);
    });

    it("tells Bob live: system messages, member removed, new owner, and Alice offline", () => {
      const systemContents = bobEvents.filter((e) => e.event === "message:new").map((e) => e.payload.message.content);
      expect(systemContents).toEqual(
        expect.arrayContaining(["Alice a supprimé son compte", "Alice a supprimé son compte, Bob est maintenant propriétaire"]),
      );
      expect(bobEvents).toContainEqual({
        event: "member:role_changed",
        payload: { conversationId: groupId, member: { id: bob.id, role: "OWNER" } },
      });
      expect(bobEvents).toContainEqual({ event: "member:removed", payload: { conversationId: directId, member: { id: alice.id } } });
      expect(bobEvents).toContainEqual({ event: "presence:update", payload: { userId: alice.id, online: false } });
    });
  });
});
