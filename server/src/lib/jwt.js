import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;

// Fail loudly at boot rather than silently signing tokens with `undefined` —
// that would make every token "valid" against a wrong/empty secret.
if (!SECRET || SECRET.length < 32) {
  throw new Error("JWT_SECRET env var must be set to a string of at least 32 characters");
}

const EXPIRES_IN = "7d";

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
