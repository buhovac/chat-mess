import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { signToken } from "../../lib/jwt.js";
import { hashPassword } from "../../lib/password.js";

const emailPrefix = "groups-test-";
let passwordHash;
let userCounter = 0;

async function makeUser(label) {
  userCounter += 1;
  return prisma.user.create({
    data: { email: `${emailPrefix}${label}-${userCounter}@example.com`, passwordHash, displayName: label },
  });
}

function cookieFor(user) {
  return `token=${signToken({ id: user.id, email: user.email, displayName: user.displayName, plan: user.plan })}`;
}

// Bypasses the create-conversation endpoint (and its >=3-members rule) so
// tests can set up whatever membership shape they need directly, including
// ones the API itself would never produce (e.g. a lone OWNER).
async function makeGroup(name, members) {
  return prisma.conversation.create({
    data: {
      type: "GROUP",
      name,
      createdById: members[0].user.id,
      members: { create: members.map(({ user, role }) => ({ userId: user.id, role })) },
    },
  });
}

let owner, admin, member, outsider;
let cookieOwner, cookieAdmin, cookieMember, cookieOutsider;

beforeAll(async () => {
  passwordHash = await hashPassword("password123");
  [owner, admin, member, outsider] = await Promise.all([
    makeUser("Owner"),
    makeUser("Admin"),
    makeUser("Member"),
    makeUser("Outsider"),
  ]);
  cookieOwner = cookieFor(owner);
  cookieAdmin = cookieFor(admin);
  cookieMember = cookieFor(member);
  cookieOutsider = cookieFor(outsider);
});

afterAll(async () => {
  // Every conversation created in this file has at least one member whose
  // email starts with emailPrefix — this catches them all, including ones
  // a test deleted itself (deleteMany on zero rows is a no-op).
  await prisma.conversation.deleteMany({ where: { members: { some: { user: { email: { startsWith: emailPrefix } } } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: emailPrefix } } });
  await prisma.$disconnect();
});

describe("POST /api/conversations (type: GROUP)", () => {
  it("creates a group: creator OWNER, others MEMBER, total >= 3", async () => {
    const [a, b] = await Promise.all([makeUser("Extra1"), makeUser("Extra2")]);

    const res = await request(app)
      .post("/api/conversations")
      .set("Cookie", cookieOwner)
      .send({ type: "GROUP", name: "Squad", memberIds: [a.id, b.id] });

    expect(res.status).toBe(201);
    expect(res.body.conversation.type).toBe("GROUP");
    expect(res.body.conversation.name).toBe("Squad");
    expect(res.body.conversation.memberCount).toBe(3);
    expect(res.body.conversation.myRole).toBe("OWNER");
    const roles = res.body.conversation.members.map((m) => m.role).sort();
    expect(roles).toEqual(["MEMBER", "MEMBER", "OWNER"]);
  });

  it("422s when the distinct other-member count is below 2 (total < 3)", async () => {
    const a = await makeUser("Extra3");

    // Duplicate id dedupes down to a single distinct other member —
    // creator + 1 = 2 total, below the >=3 rule.
    const res = await request(app)
      .post("/api/conversations")
      .set("Cookie", cookieOwner)
      .send({ type: "GROUP", name: "Too small", memberIds: [a.id, a.id] });

    expect(res.status).toBe(422);
  });
});

describe("PATCH /api/conversations/:id (rename)", () => {
  it("allows OWNER", async () => {
    const conversation = await makeGroup("Rename me", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app)
      .patch(`/api/conversations/${conversation.id}`)
      .set("Cookie", cookieOwner)
      .send({ name: "Renamed by owner" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed by owner");
  });

  it("allows ADMIN", async () => {
    const conversation = await makeGroup("Rename me 2", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app)
      .patch(`/api/conversations/${conversation.id}`)
      .set("Cookie", cookieAdmin)
      .send({ name: "Renamed by admin" });

    expect(res.status).toBe(200);
  });

  it("denies MEMBER (403)", async () => {
    const conversation = await makeGroup("Rename me 3", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app)
      .patch(`/api/conversations/${conversation.id}`)
      .set("Cookie", cookieMember)
      .send({ name: "Renamed by member" });

    expect(res.status).toBe(403);
  });

  it("denies a non-member (404, not 403)", async () => {
    const conversation = await makeGroup("Rename me 4", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app)
      .patch(`/api/conversations/${conversation.id}`)
      .set("Cookie", cookieOutsider)
      .send({ name: "Renamed by outsider" });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/conversations/:id/members (add member)", () => {
  it("allows OWNER", async () => {
    const conversation = await makeGroup("Add via owner", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);
    const target = await makeUser("AddTargetOwner");

    const res = await request(app)
      .post(`/api/conversations/${conversation.id}/members`)
      .set("Cookie", cookieOwner)
      .send({ userId: target.id });

    expect(res.status).toBe(201);
    expect(res.body.member).toMatchObject({ id: target.id, role: "MEMBER" });
  });

  it("allows ADMIN", async () => {
    const conversation = await makeGroup("Add via admin", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);
    const target = await makeUser("AddTargetAdmin");

    const res = await request(app)
      .post(`/api/conversations/${conversation.id}/members`)
      .set("Cookie", cookieAdmin)
      .send({ userId: target.id });

    expect(res.status).toBe(201);
  });

  it("denies MEMBER (403)", async () => {
    const conversation = await makeGroup("Add via member", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);
    const target = await makeUser("AddTargetMember");

    const res = await request(app)
      .post(`/api/conversations/${conversation.id}/members`)
      .set("Cookie", cookieMember)
      .send({ userId: target.id });

    expect(res.status).toBe(403);
  });

  it("denies a non-member (404, not 403)", async () => {
    const conversation = await makeGroup("Add via outsider", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);
    const target = await makeUser("AddTargetOutsider");

    const res = await request(app)
      .post(`/api/conversations/${conversation.id}/members`)
      .set("Cookie", cookieOutsider)
      .send({ userId: target.id });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/conversations/:id/members/:userId (remove member)", () => {
  it("allows OWNER to remove any role", async () => {
    const conversation = await makeGroup("Remove via owner", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app)
      .delete(`/api/conversations/${conversation.id}/members/${admin.id}`)
      .set("Cookie", cookieOwner);

    expect(res.status).toBe(200);
  });

  it("allows ADMIN to remove a MEMBER", async () => {
    const conversation = await makeGroup("Remove via admin ok", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app)
      .delete(`/api/conversations/${conversation.id}/members/${member.id}`)
      .set("Cookie", cookieAdmin);

    expect(res.status).toBe(200);
  });

  it("denies ADMIN removing another ADMIN (403)", async () => {
    const secondAdmin = await makeUser("SecondAdmin");
    const conversation = await makeGroup("Remove via admin denied", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: secondAdmin, role: "ADMIN" },
    ]);

    const res = await request(app)
      .delete(`/api/conversations/${conversation.id}/members/${secondAdmin.id}`)
      .set("Cookie", cookieAdmin);

    expect(res.status).toBe(403);
  });

  it("denies MEMBER (403)", async () => {
    const conversation = await makeGroup("Remove via member", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app)
      .delete(`/api/conversations/${conversation.id}/members/${admin.id}`)
      .set("Cookie", cookieMember);

    expect(res.status).toBe(403);
  });

  it("denies a non-member (404, not 403)", async () => {
    const conversation = await makeGroup("Remove via outsider", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app)
      .delete(`/api/conversations/${conversation.id}/members/${admin.id}`)
      .set("Cookie", cookieOutsider);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/conversations/:id/members/:userId (change role)", () => {
  it("allows OWNER", async () => {
    const conversation = await makeGroup("Role via owner", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app)
      .patch(`/api/conversations/${conversation.id}/members/${member.id}`)
      .set("Cookie", cookieOwner)
      .send({ role: "ADMIN" });

    expect(res.status).toBe(200);
    expect(res.body.member).toMatchObject({ id: member.id, role: "ADMIN" });
  });

  it("denies ADMIN (403)", async () => {
    const conversation = await makeGroup("Role via admin", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app)
      .patch(`/api/conversations/${conversation.id}/members/${member.id}`)
      .set("Cookie", cookieAdmin)
      .send({ role: "ADMIN" });

    expect(res.status).toBe(403);
  });

  it("denies MEMBER (403)", async () => {
    const secondMember = await makeUser("SecondMember");
    const conversation = await makeGroup("Role via member", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
      { user: secondMember, role: "MEMBER" },
    ]);

    const res = await request(app)
      .patch(`/api/conversations/${conversation.id}/members/${secondMember.id}`)
      .set("Cookie", cookieMember)
      .send({ role: "ADMIN" });

    expect(res.status).toBe(403);
  });

  it("denies a non-member (404, not 403)", async () => {
    const conversation = await makeGroup("Role via outsider", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app)
      .patch(`/api/conversations/${conversation.id}/members/${member.id}`)
      .set("Cookie", cookieOutsider)
      .send({ role: "ADMIN" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/conversations/:id (delete group)", () => {
  it("denies ADMIN (403)", async () => {
    const conversation = await makeGroup("Delete via admin", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app).delete(`/api/conversations/${conversation.id}`).set("Cookie", cookieAdmin);
    expect(res.status).toBe(403);
  });

  it("denies MEMBER (403)", async () => {
    const conversation = await makeGroup("Delete via member", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app).delete(`/api/conversations/${conversation.id}`).set("Cookie", cookieMember);
    expect(res.status).toBe(403);
  });

  it("denies a non-member (404, not 403)", async () => {
    const conversation = await makeGroup("Delete via outsider", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app).delete(`/api/conversations/${conversation.id}`).set("Cookie", cookieOutsider);
    expect(res.status).toBe(404);
  });

  it("allows OWNER and removes the conversation", async () => {
    const conversation = await makeGroup("Delete via owner", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app).delete(`/api/conversations/${conversation.id}`).set("Cookie", cookieOwner);
    expect(res.status).toBe(204);

    const stillThere = await prisma.conversation.findUnique({ where: { id: conversation.id } });
    expect(stillThere).toBeNull();
  });
});

describe("POST /api/conversations/:id/leave", () => {
  it("422s when OWNER leaves without transferTo while other members remain", async () => {
    const conversation = await makeGroup("Leave no transfer", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app).post(`/api/conversations/${conversation.id}/leave`).set("Cookie", cookieOwner).send({});
    expect(res.status).toBe(422);

    const stillThere = await prisma.conversation.findUnique({ where: { id: conversation.id } });
    expect(stillThere).not.toBeNull();
  });

  it("transfers ownership and removes the leaving OWNER when transferTo is valid", async () => {
    const conversation = await makeGroup("Leave with transfer", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app)
      .post(`/api/conversations/${conversation.id}/leave`)
      .set("Cookie", cookieOwner)
      .send({ transferTo: admin.id });

    expect(res.status).toBe(200);

    const newOwner = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: conversation.id, userId: admin.id } },
    });
    expect(newOwner.role).toBe("OWNER");

    const leftOwner = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: conversation.id, userId: owner.id } },
    });
    expect(leftOwner).toBeNull();
  });

  it("lets ADMIN/MEMBER leave freely", async () => {
    const conversation = await makeGroup("Leave as member", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app).post(`/api/conversations/${conversation.id}/leave`).set("Cookie", cookieMember).send({});
    expect(res.status).toBe(200);

    const gone = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: conversation.id, userId: member.id } },
    });
    expect(gone).toBeNull();
  });

  // Agreed follow-up: an empty GROUP left behind by its last member is
  // useless dead data, so this is the same cleanup as an explicit delete —
  // it must not orphan a memberless conversation forever.
  it("deletes the conversation when the OWNER leaves as the last remaining member", async () => {
    const conversation = await makeGroup("Leave as last member", [{ user: owner, role: "OWNER" }]);

    const res = await request(app).post(`/api/conversations/${conversation.id}/leave`).set("Cookie", cookieOwner).send({});
    expect(res.status).toBe(204);

    const stillThere = await prisma.conversation.findUnique({ where: { id: conversation.id } });
    expect(stillThere).toBeNull();
  });

  it("denies a non-member (404)", async () => {
    const conversation = await makeGroup("Leave via outsider", [
      { user: owner, role: "OWNER" },
      { user: admin, role: "ADMIN" },
      { user: member, role: "MEMBER" },
    ]);

    const res = await request(app)
      .post(`/api/conversations/${conversation.id}/leave`)
      .set("Cookie", cookieOutsider)
      .send({});
    expect(res.status).toBe(404);
  });
});
