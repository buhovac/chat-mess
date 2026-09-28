import { createContext, useContext, useEffect, useState } from "react";
import { socket } from "../../lib/socket.js";

const ConnectionStatusContext = createContext("connected");

// Tracks live socket connection state so the shell can show a "Reconnexion…"
// pill and the composer can refuse to queue a send while offline, instead of
// a message silently going nowhere until the socket comes back.
export function ConnectionStatusProvider({ children }) {
  const [status, setStatus] = useState(socket.connected ? "connected" : "connecting");

  useEffect(() => {
    function handleConnect() {
      setStatus("connected");
    }
    function handleDisconnect() {
      setStatus("connecting");
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    // socket.io-client fires "connect" again on every successful reconnect —
    // "reconnect_attempt" (on the manager, not the socket) is what flips the
    // pill back on the moment a drop is detected.
    socket.io.on("reconnect_attempt", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.io.off("reconnect_attempt", handleDisconnect);
    };
  }, []);

  return <ConnectionStatusContext.Provider value={status}>{children}</ConnectionStatusContext.Provider>;
}

export function useConnectionStatus() {
  return useContext(ConnectionStatusContext);
}
