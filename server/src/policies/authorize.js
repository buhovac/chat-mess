// Single source of truth for access decisions (see CLAUDE.md) — pure
// functions, no I/O, reused identically by REST routers and (later)
// Socket.IO handlers so there's never a second, drifting copy of a rule.

export function canReadConversation(user, membership) {
  return Boolean(membership);
}

export function canPostMessage(user, membership) {
  // Conversation has no deletedAt column yet — membership is the only gate
  // for now. Extend this once conversations can be archived/soft-deleted.
  return Boolean(membership);
}
