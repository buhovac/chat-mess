import { z } from "zod";

export const changePlanSchema = z.object({
  plan: z.enum(["FREE", "PRO"]),
});

// Same bounds as registerSchema (auth/schema.js) — a profile edit must not
// accept a name that registration would have refused.
export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
});

// Both fields keep the 128 max: currentPassword goes through bcrypt too, so
// an unbounded one is the same CPU-exhaustion lever as on /login.
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1).max(128),
});
