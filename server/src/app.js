import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./lib/prisma.js";
import authRouter from "./modules/auth/router.js";
import usersRouter from "./modules/users/router.js";
import conversationsRouter from "./modules/conversations/router.js";
import messagesRouter from "./modules/messages/router.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Proof-of-life endpoint: also confirms the api container can reach Postgres.
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "connected" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/conversations/:id/messages", messagesRouter);

// In production the same process also serves the built React app —
// one service, one process, one port (see /docs "moins d'éléments mobiles").
if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));
  app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
}
