import { z } from "zod";

const MAX_IDS = 100;

// ids arrives as a single comma-separated query param ("?ids=a,b,c") — split
// first, then validate each id and the resulting count.
export const presenceQuerySchema = z.object({
  ids: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().cuid()).min(1).max(MAX_IDS)),
});
