// UI-only mirror of server/src/policies/authorize.js's group permission
// matrix — used purely to decide which buttons to render. It is NOT the
// source of truth: every mutation is re-checked by authorize.js on the
// server regardless of what this says, so a stale or wrong guess here can
// only ever produce a hidden button or a 403, never an unauthorized action.

export function canAddMember(myRole) {
  return myRole === "OWNER" || myRole === "ADMIN";
}

export function canRemoveMember(myRole, targetRole) {
  if (myRole === "OWNER") return true;
  if (myRole === "ADMIN") return targetRole === "MEMBER";
  return false;
}

export function canChangeRole(myRole, targetRole) {
  return myRole === "OWNER" && targetRole !== "OWNER";
}

export function canRename(myRole) {
  return myRole === "OWNER" || myRole === "ADMIN";
}

export function canDeleteConversation(myRole) {
  return myRole === "OWNER";
}
