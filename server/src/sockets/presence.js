// In-memory only — correct as long as the API runs as a single Railway
// replica. Multiple replicas would each have their own Map and disagree on
// who's online; that's a Redis-pubsub problem for if/when we scale, not now.
const onlineSockets = new Map(); // userId -> Set<socketId>

// Returns true the moment a user's *first* socket connects (so callers only
// broadcast "online" once, not once per tab/device).
export function addSocket(userId, socketId) {
  const wasOffline = !onlineSockets.has(userId);
  if (wasOffline) {
    onlineSockets.set(userId, new Set());
  }
  onlineSockets.get(userId).add(socketId);
  return wasOffline;
}

// Returns true the moment a user's *last* socket disconnects.
export function removeSocket(userId, socketId) {
  const sockets = onlineSockets.get(userId);
  if (!sockets) return false;

  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineSockets.delete(userId);
    return true;
  }
  return false;
}

export function isOnline(userId) {
  return onlineSockets.has(userId);
}
