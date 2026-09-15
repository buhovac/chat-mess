import { parse as parseCookies } from "cookie";
import { verifyToken } from "../lib/jwt.js";

// Socket.IO handshakes don't go through Express middleware, so the cookie
// header has to be parsed by hand here instead of reusing cookie-parser.
function authenticateSocket(socket, next) {
  const rawCookie = socket.handshake.headers.cookie;
  const token = rawCookie ? parseCookies(rawCookie).token : undefined;

  if (!token) {
    return next(new Error("unauthorized"));
  }

  try {
    const payload = verifyToken(token);
    socket.data.user = { id: payload.id, email: payload.email, displayName: payload.displayName, plan: payload.plan };
    next();
  } catch {
    next(new Error("unauthorized"));
  }
}

export function registerSocketHandlers(io) {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.user.id}`);

    socket.on("disconnect", () => {
      console.log(`socket disconnected: ${socket.id} (user ${socket.data.user.id})`);
    });
  });
}
