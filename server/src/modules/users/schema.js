import { z } from "zod";

// q is optional: an empty search box shouldn't be a 400, it should just
// yield no results (the client debounces and won't even call this until
// there's real input, but the server can't trust that).
export const searchUsersQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
});
