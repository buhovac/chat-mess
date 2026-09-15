import { z } from "zod";

export const createConversationSchema = z.object({
  type: z.literal("DIRECT"),
  userId: z.string().cuid(),
});
