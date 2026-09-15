import { io } from "socket.io-client";

// Singleton — the app has one live connection regardless of how many
// components need it. autoConnect is off: AuthProvider drives connect()/
// disconnect() in step with login state, since connecting before the auth
// cookie exists would just fail the handshake.
export const socket = io({
  autoConnect: false,
  withCredentials: true,
});
