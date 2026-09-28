import { isOnline } from "../../sockets/presence.js";

export function getPresence(ids) {
  const presence = {};
  for (const id of ids) {
    presence[id] = isOnline(id);
  }
  return presence;
}
