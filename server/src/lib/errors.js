import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

// Shared with every REST module: one error shape, one place that decides
// what's safe to send to the client (never a stack trace).
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const PRISMA_ERROR_MAP = {
  // Record to update/delete not found (e.g. a stale reference, or a race
  // with another request deleting the same row) — the closest REST
  // equivalent is "the thing you asked for isn't there".
  P2025: { status: 404, code: "NOT_FOUND", message: "Resource not found" },
  // Unique constraint violation that slipped past an application-level
  // check (e.g. two racing requests) — the caller's request conflicts with
  // existing state, not a validation error.
  P2002: { status: 409, code: "CONFLICT", message: "Conflicts with an existing resource" },
};

// The ONE error-handling middleware for the app (mounted once in app.js,
// after every router) — a safety net for whatever a route didn't already
// turn into a proper response itself. Existing routes still validate with
// zod's safeParse and return 400 VALIDATION_ERROR directly (unchanged, and
// still what every test asserts on) — this only catches what nothing else
// does:
//  - AppError (a route already decided status/code) -> passthrough
//  - a raw ZodError (some future .parse() instead of .safeParse()) -> 422
//    with a per-field breakdown
//  - a known Prisma error that escaped a service -> mapped 404/409
//  - anything else -> 500, logged with the request id, never a stack to the client
export function errorHandler(err, req, res, _next) {
  if (err.status) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  if (err instanceof ZodError) {
    const fields = Object.fromEntries(err.issues.map((issue) => [issue.path.join(".") || "_", issue.message]));
    return res.status(422).json({ error: { code: "VALIDATION_ERROR", message: err.issues[0].message, fields } });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && PRISMA_ERROR_MAP[err.code]) {
    const mapped = PRISMA_ERROR_MAP[err.code];
    return res.status(mapped.status).json({ error: { code: mapped.code, message: mapped.message } });
  }

  (req.log ?? console).error({ err }, "unhandled error");
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
}
