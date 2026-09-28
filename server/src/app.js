import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./lib/prisma.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./lib/errors.js";
import authRouter from "./modules/auth/router.js";
import usersRouter from "./modules/users/router.js";
import accountRouter from "./modules/account/router.js";
import presenceRouter from "./modules/presence/router.js";
import conversationsRouter from "./modules/conversations/router.js";
import messagesRouter from "./modules/messages/router.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

// Railway (like any host behind a reverse proxy) terminates TLS and forwards
// requests through its own proxy — without this, express-rate-limit and
// req.ip would see the proxy's IP for every request instead of the real
// client's, silently rate-limiting all users together instead of per IP.
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        // Covers fetch/XHR AND the Socket.IO polling+WebSocket upgrade —
        // both same-origin in production (one process serves API + WS + the
        // built client), so 'self' is enough without a separate ws: entry.
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173", credentials: true }));
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/health" } }));
app.use(express.json());
app.use(cookieParser());

// 300 requests/15min/IP across the whole API — a generous ceiling meant to
// catch abuse/bugs, not normal usage. /api/health is excluded so uptime
// monitoring can't get itself rate-limited alongside real users.
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.originalUrl.startsWith("/api/health"),
  }),
);

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
app.use("/api/account", accountRouter);
app.use("/api/presence", presenceRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/conversations/:id/messages", messagesRouter);

// In production the same process also serves the built React app —
// one service, one process, one port (see /docs "moins d'éléments mobiles").
if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));
  app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
}

// Must be last: the one error-handling middleware for the whole app (see
// lib/errors.js for what it catches and why the per-router copies of this
// were removed in favor of a single mount here).
app.use(errorHandler);
