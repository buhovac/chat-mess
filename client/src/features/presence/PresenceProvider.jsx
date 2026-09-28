import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { socket } from "../../lib/socket.js";

const PresenceContext = createContext(null);

// presence: { [userId]: boolean }. Initial state for a given id comes from
// GET /api/presence (see ensurePresence); live transitions after that come
// from "presence:update" broadcasts, which any component just re-reads via
// the shared `presence` map instead of listening for the event itself.
export function PresenceProvider({ children }) {
  const [presence, setPresence] = useState({});
  const knownIds = useRef(new Set());

  useEffect(() => {
    function handleUpdate({ userId, online }) {
      setPresence((prev) => ({ ...prev, [userId]: online }));
    }
    socket.on("presence:update", handleUpdate);
    return () => socket.off("presence:update", handleUpdate);
  }, []);

  const ensurePresence = useCallback((ids) => {
    const unknown = ids.filter((id) => !knownIds.current.has(id));
    if (unknown.length === 0) return;
    for (const id of unknown) knownIds.current.add(id);

    api
      .get(`/api/presence?ids=${unknown.join(",")}`)
      .then((data) => setPresence((prev) => ({ ...prev, ...data.presence })))
      .catch(() => {
        // Let a failed lookup be retried later instead of "known but wrong".
        for (const id of unknown) knownIds.current.delete(id);
      });
  }, []);

  return <PresenceContext.Provider value={{ presence, ensurePresence }}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) {
    throw new Error("usePresence must be used within a PresenceProvider");
  }
  return ctx;
}
