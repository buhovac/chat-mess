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

// --- Group membership/role permissions (Stage 4) -----------------------
//
// Every function below takes membership objects shaped like
// { userId, role, conversationType }, as produced by loadMembership.js —
// conversationType lives on the membership (not a separate param) so a
// single check here also enforces "DIRECT conversations are immutable":
// every function returns false when conversationType !== "GROUP", since a
// DIRECT pair has no roles to change, no members to add/remove, and no
// name to rename.

export function canAddMember(actorMembership) {
  return (
    Boolean(actorMembership) &&
    actorMembership.conversationType === "GROUP" &&
    (actorMembership.role === "OWNER" || actorMembership.role === "ADMIN")
  );
}

// Self-removal is deliberately excluded here (actor === target): leaving is
// its own operation (canLeave) because an OWNER leaving has to handle
// ownership transfer, which a plain "remove" can't express.
export function canRemoveMember(actorMembership, targetMembership) {
  if (!actorMembership || !targetMembership) return false;
  if (actorMembership.conversationType !== "GROUP") return false;
  if (actorMembership.userId === targetMembership.userId) return false;
  if (actorMembership.role === "OWNER") return true;
  if (actorMembership.role === "ADMIN") return targetMembership.role === "MEMBER";
  return false;
}

// Only OWNER promotes/demotes, and only ever to ADMIN or MEMBER — moving
// someone to OWNER (ownership transfer) only happens through canLeave's
// transfer path, never through a plain role change.
export function canChangeRole(actorMembership, targetMembership, newRole) {
  if (!actorMembership || !targetMembership) return false;
  if (actorMembership.conversationType !== "GROUP") return false;
  if (actorMembership.role !== "OWNER") return false;
  if (actorMembership.userId === targetMembership.userId) return false;
  if (targetMembership.role === "OWNER") return false;
  return newRole === "ADMIN" || newRole === "MEMBER";
}

export function canRename(actorMembership) {
  return (
    Boolean(actorMembership) &&
    actorMembership.conversationType === "GROUP" &&
    (actorMembership.role === "OWNER" || actorMembership.role === "ADMIN")
  );
}

// false means "not a plain leave" — for a valid GROUP membership that can
// only mean OWNER with other members still present, which the caller
// resolves via the transferTo path (see conversations/service.js) instead
// of a second permission check here.
export function canLeave(actorMembership, memberCount) {
  if (!actorMembership || actorMembership.conversationType !== "GROUP") return false;
  if (actorMembership.role === "OWNER" && memberCount > 1) return false;
  return true;
}

export function canDeleteConversation(actorMembership) {
  return (
    Boolean(actorMembership) &&
    actorMembership.conversationType === "GROUP" &&
    actorMembership.role === "OWNER"
  );
}
