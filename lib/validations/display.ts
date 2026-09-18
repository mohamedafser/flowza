import { z } from "zod";

export const DISPLAY_MODES = ["QUEUE"] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

export const DISPLAY_THEMES = ["light", "dark", "system"] as const;
export type DisplayTheme = (typeof DISPLAY_THEMES)[number];

export const DISPLAY_NAME_MIN = 1;
export const DISPLAY_NAME_MAX = 80;
export const DISPLAY_NEXT_TOKEN_MIN = 1;
export const DISPLAY_NEXT_TOKEN_MAX = 12;
export const DEFAULT_NEXT_TOKEN_COUNT = 3;

export const displaySettingsSchema = z.object({
  nextTokenCount: z
    .number()
    .int()
    .min(DISPLAY_NEXT_TOKEN_MIN)
    .max(DISPLAY_NEXT_TOKEN_MAX)
    .default(DEFAULT_NEXT_TOKEN_COUNT),
  showRestaurantLogo: z.boolean().default(true),
  showBranchName: z.boolean().default(true),
  showQueueName: z.boolean().default(true),
  theme: z.enum(DISPLAY_THEMES).default("dark"),
  preferFullscreen: z.boolean().default(false),
});

export type DisplaySettings = z.infer<typeof displaySettingsSchema>;

export const displaySettingsInputSchema = displaySettingsSchema.partial();

export const createDisplaySchema = z.object({
  restaurantId: z.string().uuid("Select a restaurant."),
  branchId: z.string().uuid("Select a branch."),
  queueId: z.string().uuid("Select a queue."),
  name: z
    .string()
    .trim()
    .min(DISPLAY_NAME_MIN, "Display name is required.")
    .max(DISPLAY_NAME_MAX, "Display name is too long."),
  isActive: z.boolean().default(true),
  settings: displaySettingsInputSchema.optional(),
});

export type CreateDisplayInput = z.infer<typeof createDisplaySchema>;

export const updateDisplaySchema = z.object({
  displayId: z.string().uuid("Invalid display."),
  branchId: z.string().uuid("Select a branch.").optional(),
  queueId: z.string().uuid("Select a queue.").optional(),
  name: z
    .string()
    .trim()
    .min(DISPLAY_NAME_MIN, "Display name is required.")
    .max(DISPLAY_NAME_MAX, "Display name is too long.")
    .optional(),
  isActive: z.boolean().optional(),
  settings: displaySettingsInputSchema.optional(),
});

export type UpdateDisplayInput = z.infer<typeof updateDisplaySchema>;

export const setDisplayStatusSchema = z.object({
  displayId: z.string().uuid("Invalid display."),
  isActive: z.boolean(),
});

export type SetDisplayStatusInput = z.infer<typeof setDisplayStatusSchema>;

export const displayIdSchema = z.object({
  displayId: z.string().uuid("Invalid display."),
});

export function normalizeDisplaySettings(input: unknown): DisplaySettings {
  const parsed = displaySettingsSchema.safeParse(input ?? {});
  if (parsed.success) {
    return parsed.data;
  }
  return displaySettingsSchema.parse({});
}
