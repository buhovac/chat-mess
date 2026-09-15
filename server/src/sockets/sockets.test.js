import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as ioClient } from "socket.io-client";
import { registerSocketHandlers } from "./index.js";
import { signToken } from "../lib/jwt.js";

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
