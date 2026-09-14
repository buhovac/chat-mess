import { describe, it, expect } from "vitest";
import { canReadConversation, canPostMessage } from "./authorize.js";

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
