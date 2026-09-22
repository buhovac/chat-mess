import { describe, it, expect } from "vitest";
import {
  canReadConversation,
  canPostMessage,
  canAddMember,
  canRemoveMember,
  canChangeRole,
  canRename,
  canLeave,
  canDeleteConversation,
} from "./authorize.js";

const user = { id: "user-1" };
const membership = { conversationId: "conv-1", userId: "user-1" };

describe("canReadConversation", () => {
  it("allows a member to read", () => {
    expect(canReadConversation(user, membership)).toBe(true);
  });

  it("denies a non-member", () => {
    expect(canReadConversation(user, undefined)).toBe(false);
  });
});

describe("canPostMessage", () => {
  it("allows a member to post", () => {
    expect(canPostMessage(user, membership)).toBe(true);
  });

  it("denies a non-member", () => {
    expect(canPostMessage(user, null)).toBe(false);
  });
});

// --- Stage 4 permission matrix -------------------------------------------
//
// Actor           OWNER  ADMIN  MEMBER  non-member
// Add member       yes    yes    no      no
// Remove member    yes*   yes**  no      no    (* any target, ** MEMBER-only target)
// Promote/demote   yes    no     no      no
// Rename group     yes    yes    no      no
// Leave group      yes    yes    yes     —
// Delete group     yes    no     no      no
//
// Every row also has to be `false` for a DIRECT conversation regardless of
// role — that's tested separately per function below rather than folded
// into this table, since a DIRECT actor still has a role but the whole
// action must be a no-op.

function actor(role, conversationType = "GROUP") {
  return role ? { userId: "actor-1", role, conversationType } : null;
}

function target(role, userId = "target-1", conversationType = "GROUP") {
  return { userId, role, conversationType };
}

describe("canAddMember", () => {
  it.each([
    ["OWNER", true],
    ["ADMIN", true],
    ["MEMBER", false],
    [null, false], // non-member
  ])("actor role %s -> %s", (role, expected) => {
    expect(canAddMember(actor(role))).toBe(expected);
  });

  it("denies on a DIRECT conversation even for the OWNER-equivalent member", () => {
    expect(canAddMember(actor("OWNER", "DIRECT"))).toBe(false);
  });
});

describe("canRemoveMember", () => {
  it.each([
    ["OWNER", "OWNER", true],
    ["OWNER", "ADMIN", true],
    ["OWNER", "MEMBER", true],
    ["ADMIN", "OWNER", false],
    ["ADMIN", "ADMIN", false],
    ["ADMIN", "MEMBER", true],
    ["MEMBER", "OWNER", false],
    ["MEMBER", "ADMIN", false],
    ["MEMBER", "MEMBER", false],
    [null, "MEMBER", false], // non-member
  ])("actor %s removing target %s -> %s", (actorRole, targetRole, expected) => {
    expect(canRemoveMember(actor(actorRole), target(targetRole))).toBe(expected);
  });

  it("denies removing yourself (must go through canLeave instead)", () => {
    const self = actor("OWNER");
    expect(canRemoveMember(self, target("OWNER", self.userId))).toBe(false);
  });

  it("denies on a DIRECT conversation", () => {
    expect(canRemoveMember(actor("OWNER", "DIRECT"), target("MEMBER", "target-1", "DIRECT"))).toBe(false);
  });
});

describe("canChangeRole", () => {
  it.each([
    ["OWNER", "ADMIN", "ADMIN", true],
    ["OWNER", "MEMBER", "ADMIN", true],
    ["OWNER", "MEMBER", "MEMBER", true],
    ["ADMIN", "MEMBER", "ADMIN", false],
    ["MEMBER", "MEMBER", "ADMIN", false],
    [null, "MEMBER", "ADMIN", false], // non-member
  ])("actor %s changing target %s to %s -> %s", (actorRole, targetRole, newRole, expected) => {
    expect(canChangeRole(actor(actorRole), target(targetRole), newRole)).toBe(expected);
  });

  it("denies promoting a target to OWNER (ownership only transfers via leave)", () => {
    expect(canChangeRole(actor("OWNER"), target("MEMBER"), "OWNER")).toBe(false);
  });

  it("denies changing another OWNER's role", () => {
    expect(canChangeRole(actor("OWNER"), target("OWNER"), "MEMBER")).toBe(false);
  });

  it("denies changing your own role", () => {
    const self = actor("OWNER");
    expect(canChangeRole(self, target("OWNER", self.userId), "MEMBER")).toBe(false);
  });

  it("denies on a DIRECT conversation", () => {
    expect(canChangeRole(actor("OWNER", "DIRECT"), target("MEMBER", "target-1", "DIRECT"), "ADMIN")).toBe(false);
  });
});

describe("canRename", () => {
  it.each([
    ["OWNER", true],
    ["ADMIN", true],
    ["MEMBER", false],
    [null, false], // non-member
  ])("actor role %s -> %s", (role, expected) => {
    expect(canRename(actor(role))).toBe(expected);
  });

  it("denies on a DIRECT conversation", () => {
    expect(canRename(actor("OWNER", "DIRECT"))).toBe(false);
  });
});

describe("canLeave", () => {
  it.each([
    ["OWNER", 1, true], // last member: plain leave (service layer deletes the now-empty group)
    ["OWNER", 3, false], // others remain: not a plain leave, caller must use the transferTo path
    ["ADMIN", 3, true],
    ["MEMBER", 3, true],
    [null, 3, false], // non-member
  ])("actor role %s, memberCount %s -> %s", (role, memberCount, expected) => {
    expect(canLeave(actor(role), memberCount)).toBe(expected);
  });

  it("denies on a DIRECT conversation", () => {
    expect(canLeave(actor("MEMBER", "DIRECT"), 2)).toBe(false);
  });
});

describe("canDeleteConversation", () => {
  it.each([
    ["OWNER", true],
    ["ADMIN", false],
    ["MEMBER", false],
    [null, false], // non-member
  ])("actor role %s -> %s", (role, expected) => {
    expect(canDeleteConversation(actor(role))).toBe(expected);
  });

  it("denies on a DIRECT conversation", () => {
    expect(canDeleteConversation(actor("OWNER", "DIRECT"))).toBe(false);
  });
});
