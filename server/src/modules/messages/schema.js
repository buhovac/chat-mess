import { z } from "zod";

export const listMessagesQuerySchema = z.object({
  before: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(50),
});
