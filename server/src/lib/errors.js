// Shared with every REST module: one error shape, one place that decides
// what's safe to send to the client (never a stack trace). Mirrors the
// pattern already used locally in modules/auth/router.js.
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorHandler(err, _req, res, _next) {
  if (err.status) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
}
