import { z } from "zod";

// q is optional: an empty search box shouldn't be a 400. Both "new
// conversation" and "new group" dialogs call it with q="" on open to list
// colleagues right away (see service.js).
export const searchUsersQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
});
