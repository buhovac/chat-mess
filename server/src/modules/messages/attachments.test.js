import { Readable } from "node:stream";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";

// Never talk to the real R2 in tests: the storage module is replaced by
// in-memory fakes. vi.mock is hoisted above the imports below, so app.js
// already gets the fake when it loads the attachments router.
vi.mock("../../lib/storage.js", () => ({
  isStorageConfigured: vi.fn(() => true),
  uploadFile: vi.fn(async () => {}),
  getFileStream: vi.fn(),
}));

import { app } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { signToken } from "../../lib/jwt.js";
import { hashPassword } from "../../lib/password.js";
import { getFileStream, isStorageConfigured, uploadFile } from "../../lib/storage.js";

const emailPrefix = "attachments-test-";

// Smallest byte sequences that pass the signature check — the bytes after
// the header don't matter for these tests.
const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const PDF_BYTES = Buffer.from("%PDF-1.4\n%fake pdf body\n");
// Windows executables start with "MZ".
const EXE_BYTES = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)]);

let userA;
let outsider;
let cookieA;
let cookieOutsider;
let conversationId;
const emit = vi.fn();
const to = vi.fn(() => ({ emit }));

function cookieFor(user) {
  return `token=${signToken({ id: user.id, email: user.email, displayName: user.displayName, plan: user.plan })}`;
}

function postFile(cookie, buffer, filename, contentType) {
  return request(app)
    .post(`/api/conversations/${conversationId}/attachments`)
    .set("Cookie", cookie)
    .attach("file", buffer, { filename, contentType });
}

beforeAll(async () => {
  const passwordHash = await hashPassword("password123");
  let userB;
  [userA, userB, outsider] = await Promise.all([
    prisma.user.create({ data: { email: `${emailPrefix}a@example.com`, passwordHash, displayName: "User A" } }),
    prisma.user.create({ data: { email: `${emailPrefix}b@example.com`, passwordHash, displayName: "User B" } }),
    prisma.user.create({ data: { email: `${emailPrefix}outsider@example.com`, passwordHash, displayName: "Outsider" } }),
  ]);
  cookieA = cookieFor(userA);
  cookieOutsider = cookieFor(outsider);

  const conversation = await prisma.conversation.create({
    data: {
      type: "DIRECT",
      directKey: [userA.id, userB.id].sort().join(":"),
      createdById: userA.id,
      members: { create: [{ userId: userA.id }, { userId: userB.id }] },
    },
  });
  conversationId = conversation.id;

  // A fake io: lets us assert on what was emitted without a real socket server.
  app.set("io", { to });
});

beforeEach(() => {
  vi.clearAllMocks();
  isStorageConfigured.mockReturnValue(true);
});

afterAll(async () => {
  app.set("io", undefined);
  await prisma.conversation.deleteMany({ where: { id: conversationId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: emailPrefix } } });
  await prisma.$disconnect();
});

describe("POST /api/conversations/:id/attachments", () => {
  it("returns 404 for a non-member and uploads nothing", async () => {
    const res = await postFile(cookieOutsider, PNG_BYTES, "photo.png", "image/png");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("rejects a file over 5 MB with 413", async () => {
    const big = Buffer.concat([PNG_BYTES, Buffer.alloc(6 * 1024 * 1024)]);
    const res = await postFile(cookieA, big, "big.png", "image/png");
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("FILE_TOO_LARGE");
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("rejects an executable even when it claims to be image/png (422)", async () => {
    const res = await postFile(cookieA, EXE_BYTES, "photo.png", "image/png");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("returns 400 when no file is sent", async () => {
    const res = await request(app).post(`/api/conversations/${conversationId}/attachments`).set("Cookie", cookieA);
    expect(res.status).toBe(400);
  });

  it("returns 503 when storage isn't configured", async () => {
    isStorageConfigured.mockReturnValue(false);
    const res = await postFile(cookieA, PNG_BYTES, "photo.png", "image/png");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("STORAGE_UNAVAILABLE");
  });

  it("uploads an image, creates the Message and emits message:new", async () => {
    const res = await postFile(cookieA, PNG_BYTES, "capture d'écran.png", "image/png");

    expect(res.status).toBe(201);
    const { message } = res.body;
    expect(message).toMatchObject({
      content: "",
      attachmentUrl: `/api/attachments/${message.id}`,
      attachmentType: "image/png",
      attachmentName: "capture d'écran.png",
      attachmentSize: PNG_BYTES.length,
      sender: { id: userA.id },
    });

    // Stored under a random key, never the original filename.
    const [, key, contentType] = uploadFile.mock.calls[0];
    expect(key).toMatch(new RegExp(`^conversations/${conversationId}/[0-9a-f-]{36}\\.png$`));
    expect(contentType).toBe("image/png");

    const row = await prisma.message.findUnique({ where: { id: message.id } });
    expect(row).toMatchObject({ attachmentUrl: key, attachmentType: "image/png", attachmentSize: PNG_BYTES.length });

    expect(to).toHaveBeenCalledWith(`conversation:${conversationId}`);
    // The emitted payload holds a real Date; res.body has its JSON string — compare ids.
    const [event, payload] = emit.mock.calls[0];
    expect(event).toBe("message:new");
    expect(payload).toMatchObject({ conversationId, message: { id: message.id, attachmentType: "image/png" } });
  });

  it("takes the type from the bytes, not the declared Content-Type", async () => {
    const res = await postFile(cookieA, PDF_BYTES, "rapport.pdf", "application/octet-stream");
    expect(res.status).toBe(201);
    expect(res.body.message.attachmentType).toBe("application/pdf");
  });
});

describe("GET /api/attachments/:messageId", () => {
  let messageId;

  beforeAll(async () => {
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userA.id,
        content: "",
        attachmentUrl: "conversations/x/fake.pdf",
        attachmentType: "application/pdf",
        attachmentName: "réunion.pdf",
        attachmentSize: PDF_BYTES.length,
      },
    });
    messageId = message.id;
  });

  it("streams the file to a member with its stored type", async () => {
    getFileStream.mockResolvedValue(Readable.from([PDF_BYTES]));
    const res = await request(app).get(`/api/attachments/${messageId}`).set("Cookie", cookieA).buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain("filename*=UTF-8''r%C3%A9union.pdf");
    expect(getFileStream).toHaveBeenCalledWith("conversations/x/fake.pdf");
  });

  it("returns 404 to a non-member without touching storage", async () => {
    const res = await request(app).get(`/api/attachments/${messageId}`).set("Cookie", cookieOutsider);
    expect(res.status).toBe(404);
    expect(getFileStream).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown or malformed id", async () => {
    const unknown = await request(app).get("/api/attachments/cm0000000000000000000000").set("Cookie", cookieA);
    const malformed = await request(app).get("/api/attachments/not-an-id").set("Cookie", cookieA);
    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });
});
