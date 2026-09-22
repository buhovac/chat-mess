import { createServer } from "node:http";
import { Server } from "socket.io";
import { app } from "./app.js";
import { registerSocketHandlers } from "./sockets/index.js";

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN ?? "http://localhost:5173", credentials: true },
});

registerSocketHandlers(io);

// REST routes (conversations/router.js) need to emit to rooms and move
// sockets between them when membership changes via HTTP, not a socket
// event — this is how they reach the same `io` instance.
app.set("io", io);

const port = process.env.PORT ?? 3001;
httpServer.listen(port, () => {
  console.log(`api listening on :${port}`);
});
