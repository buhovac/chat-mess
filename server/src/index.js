import { createServer } from "node:http";
import { Server } from "socket.io";
import { app } from "./app.js";
import { registerSocketHandlers } from "./sockets/index.js";

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN ?? "http://localhost:5173", credentials: true },
});

registerSocketHandlers(io);

const port = process.env.PORT ?? 3001;
httpServer.listen(port, () => {
  console.log(`api listening on :${port}`);
});
