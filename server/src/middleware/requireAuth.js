import { verifyToken } from "../lib/jwt.js";

export function requireAuth(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Not authenticated" } });
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.id, email: payload.email, displayName: payload.displayName, plan: payload.plan };
    next();
  } catch {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Not authenticated" } });
  }
}
