import { z } from "zod";

// Upper bounds matter here even though they look redundant with express.json()'s
// body-size limit: without them, a wrong-but-plausible-looking massive password
// still reaches bcrypt (deliberately slow) on every register/login attempt —
// an easy CPU-exhaustion lever otherwise. 254 is the RFC 5321 max email length.
export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});
