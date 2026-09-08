import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

// Proof-of-life endpoint: also confirms the api container can reach Postgres.
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "connected" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// In production the same process also serves the built React app —
// one service, one process, one port (see /docs "moins d'éléments mobiles").
if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));
  app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" },
});

io.on("connection", (socket) => {
  console.log(`socket connected: ${socket.id}`);

  // Minimal echo so the client scaffold has something real to prove the
  // WebSocket round-trip works end to end (browser -> api container -> back).
  socket.on("ping:test", (payload) => {
    socket.emit("pong:test", { received: payload, at: new Date().toISOString() });
  });

  socket.on("disconnect", () => {
    console.log(`socket disconnected: ${socket.id}`);
  });
});

const port = process.env.PORT ?? 3001;
httpServer.listen(port, () => {
  console.log(`api listening on :${port}`);
});
