import { z } from "zod";
import { isValidPublicDisplayToken } from "@/lib/public-display/paths";

export const publicDisplayTokenParamSchema = z.object({
  publicToken: z
    .string()
    .min(1)
    .refine(isValidPublicDisplayToken, "Invalid display token."),
});
