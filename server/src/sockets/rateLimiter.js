// Token bucket, in memory, per userId — correct as long as the API runs as
// a single Railway replica (same assumption as sockets/presence.js). Takes
// `now` as a parameter (defaults to Date.now()) purely so it's unit-testable
// without real timers or waiting a full minute.
const CAPACITY = 60;
const REFILL_WINDOW_MS = 60_000;
const REFILL_RATE = CAPACITY / REFILL_WINDOW_MS; // tokens per ms

const buckets = new Map(); // userId -> { tokens, lastRefill }

// Returns true (and consumes a token) if the caller is under the limit,
// false if they've already sent CAPACITY messages within the last minute.
export function consumeMessageToken(userId, now = Date.now()) {
  let bucket = buckets.get(userId);
  if (!bucket) {
    bucket = { tokens: CAPACITY, lastRefill: now };
    buckets.set(userId, bucket);
  }

  const elapsed = now - bucket.lastRefill;
  if (elapsed > 0) {
    bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsed * REFILL_RATE);
    bucket.lastRefill = now;
  }

  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}
