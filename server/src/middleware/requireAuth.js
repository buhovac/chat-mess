import { authenticateToken } from "../lib/session.js";

export async function requireAuth(req, res, next) {
  try {
    const user = await authenticateToken(req.cookies?.token);
    if (!user) {
      return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Not authenticated" } });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
