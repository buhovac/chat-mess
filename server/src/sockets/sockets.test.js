import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as ioClient } from "socket.io-client";
import { registerSocketHandlers } from "./index.js";
import { signToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/password.js";

let httpServer;
let io;
let port;

beforeAll(async () => {
  httpServer = createServer();
  io = new Server(httpServer);
  registerSocketHandlers(io);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  port = httpServer.address().port;
});

afterAll(() => {
  io.close();
  httpServer.close();
});

function connect(extraHeaders) {
  return ioClient(`http://localhost:${port}`, {
    extraHeaders,
    reconnection: false,
    // Force a fresh handshake rather than reusing a cached (possibly
    // already-authenticated) engine.io transport between tests.
    forceNew: true,
  });
}

describe("Socket.IO handshake auth", () => {
  it("rejects a connection without a cookie", async () => {
    const socket = connect({});

    const error = await new Promise((resolve, reject) => {
      socket.on("connect_error", resolve);
      socket.on("connect", () => reject(new Error("should not have connected")));
    });

    expect(error.message).toBe("unauthorized");
    socket.close();
  });

  it("accepts a valid session cookie and joins room user:<id>", async () => {
    const token = signToken({ id: "socket-test-user", email: "socket-test@example.com", displayName: "Socket Test", plan: "FREE" });
    const socket = connect({ Cookie: `token=${token}` });

    await new Promise((resolve, reject) => {
      socket.on("connect", resolve);
      socket.on("connect_error", reject);
    });

    const room = io.sockets.adapter.rooms.get("user:socket-test-user");
    expect(room?.has(socket.id)).toBe(true);

    socket.close();
  });
});

describe("message:send / message:new", () => {
  const emailPrefix = "sockets-msg-test-";
  let userA;
  let userB;
  let outsider;
  let conversationId;

  beforeAll(async () => {
    const passwordHash = await hashPassword("password123");

    [userA, userB, outsider] = await Promise.all([
      prisma.user.create({ data: { email: `${emailPrefix}a@example.com`, passwordHash, displayName: "User A" } }),
      prisma.user.create({ data: { email: `${emailPrefix}b@example.com`, passwordHash, displayName: "User B" } }),
      prisma.user.create({ data: { email: `${emailPrefix}c@example.com`, passwordHash, displayName: "Outsider" } }),
    ]);

    const conversation = await prisma.conversation.create({
      data: {
        type: "DIRECT",
        directKey: [userA.id, userB.id].sort().join(":"),
        createdById: userA.id,
        members: { create: [{ userId: userA.id }, { userId: userB.id }] },
      },
    });
    conversationId = conversation.id;
  });

  afterAll(async () => {
    await prisma.conversation.deleteMany({ where: { id: conversationId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: emailPrefix } } });
  });

  function connectAs(user) {
    const token = signToken({ id: user.id, email: user.email, displayName: user.displayName, plan: user.plan });
    const socket = ioClient(`http://localhost:${port}`, {
      extraHeaders: { Cookie: `token=${token}` },
      reconnection: false,
      forceNew: true,
    });
    return new Promise((resolve, reject) => {
      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", reject);
    });
  }

  it("delivers a sent message to member sockets but never to a non-member", async () => {
    const [socketA, socketB, socketC] = await Promise.all([connectAs(userA), connectAs(userB), connectAs(outsider)]);

    // Rooms are joined asynchronously right after connect (DB lookup) — give
    // that a tick to land before A sends.
    await new Promise((resolve) => setTimeout(resolve, 100));

    const bReceived = new Promise((resolve) => socketB.once("message:new", resolve));
    let cReceived = false;
    socketC.once("message:new", () => {
      cReceived = true;
    });

    const ack = await new Promise((resolve) => {
      socketA.emit("message:send", { conversationId, content: "hello from A", clientTempId: "tmp-1" }, resolve);
    });

    expect(ack.ok).toBe(true);
    expect(ack.message.content).toBe("hello from A");
    expect(ack.message.sender).toMatchObject({ id: userA.id, displayName: "User A" });

    const payload = await bReceived;
    expect(payload.conversationId).toBe(conversationId);
    expect(payload.clientTempId).toBe("tmp-1");
    expect(payload.message.content).toBe("hello from A");
    expect(payload.message.sender).toMatchObject({ id: userA.id, displayName: "User A" });

    // Give a would-be delivery to C a moment to (not) arrive.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(cReceived).toBe(false);

    socketA.close();
    socketB.close();
    socketC.close();
  });
});
