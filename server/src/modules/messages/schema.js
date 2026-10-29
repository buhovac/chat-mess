import { z } from "zod";

export const listMessagesQuerySchema = z.object({
  before: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(50),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export const attachmentIdParamsSchema = z.object({
  messageId: z.string().cuid(),
});

// The original filename is only ever displayed (alt text, file chip,
// download name) — never used as a storage path — so it's normalized
// rather than rejected: drop any client-sent directory part, cap the length,
// and fall back to a generic name if nothing is left.
export const attachmentNameSchema = z
  .string()
  .transform((name) => name.split(/[\\/]/).pop().trim().slice(0, 200) || "fichier");
