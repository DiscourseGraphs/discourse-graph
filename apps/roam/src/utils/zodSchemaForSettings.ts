import { z } from "zod";

/* eslint-disable @typescript-eslint/naming-convention */
export const FeatureFlagsSchema = z.object({
  "Enable Left Sidebar": z.boolean().default(false),
});

export const GlobalSettingsSchema = z.object({
  "Left Sidebar": z.object({
    Children: z.array(z.string()),
    Settings: z.object({
      Foldable: z.boolean(),
      "Truncate at": z.number().int(),
    }),
  }),
});
/* eslint-disable @typescript-eslint/naming-convention */

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>;
