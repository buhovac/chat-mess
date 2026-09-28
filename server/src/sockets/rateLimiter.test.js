import { describe, it, expect } from "vitest";
import { consumeMessageToken } from "./rateLimiter.js";

describe("consumeMessageToken", () => {
  it("allows up to capacity within a window, then rejects the next one", () => {
    const userId = "rate-test-capacity";
    const start = Date.now();

    for (let i = 0; i < 60; i++) {
      expect(consumeMessageToken(userId, start)).toBe(true);
    }
    expect(consumeMessageToken(userId, start)).toBe(false);
  });

  it("refills gradually rather than all-or-nothing", () => {
    const userId = "rate-test-gradual-refill";
    const start = Date.now();

    for (let i = 0; i < 60; i++) consumeMessageToken(userId, start);
    expect(consumeMessageToken(userId, start)).toBe(false);

    // Half the window later, ~30 tokens (half capacity) have refilled —
    // some room back, but nowhere near the full 60.
    const later = start + 30_000;
    for (let i = 0; i < 30; i++) {
      expect(consumeMessageToken(userId, later)).toBe(true);
    }
    expect(consumeMessageToken(userId, later)).toBe(false);
  });

  it("is back to full capacity a full window after being fully drained", () => {
    const userId = "rate-test-full-refill";
    const start = Date.now();

    for (let i = 0; i < 60; i++) consumeMessageToken(userId, start);
    expect(consumeMessageToken(userId, start)).toBe(false);

    const later = start + 60_000;
    for (let i = 0; i < 60; i++) {
      expect(consumeMessageToken(userId, later)).toBe(true);
    }
    expect(consumeMessageToken(userId, later)).toBe(false);
  });

  it("tracks separate buckets per user", () => {
    const userA = "rate-test-user-a";
    const userB = "rate-test-user-b";
    const start = Date.now();

    for (let i = 0; i < 60; i++) consumeMessageToken(userA, start);
    expect(consumeMessageToken(userA, start)).toBe(false);
    expect(consumeMessageToken(userB, start)).toBe(true);
  });
});
