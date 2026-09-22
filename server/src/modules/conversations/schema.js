import { z } from "zod";

const createDirectSchema = z.object({
  type: z.literal("DIRECT"),
  userId: z.string().cuid(),
});

const createGroupSchema = z.object({
  type: z.literal("GROUP"),
  name: z.string().trim().min(2).max(60),
  // The creator becomes OWNER automatically and isn't listed here, so this
  // is "other" members — the >=3-total rule (creator + >=2 others) is
  // enforced in service.js, once memberIds has been deduped against the
  // creator's own id.
  memberIds: z.array(z.string().cuid()).min(2),
});

export const createConversationSchema = z.discriminatedUnion("type", [createDirectSchema, createGroupSchema]);

export const addMemberSchema = z.object({
  userId: z.string().cuid(),
});

// Ownership never moves through this route — see canChangeRole in
// policies/authorize.js — so OWNER isn't a valid target role here.
export const changeRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

export const renameConversationSchema = z.object({
  name: z.string().trim().min(2).max(60),
});

export const leaveConversationSchema = z.object({
  transferTo: z.string().cuid().optional(),
});
