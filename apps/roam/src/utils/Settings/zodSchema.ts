import { z } from "zod";

/* eslint-disable @typescript-eslint/naming-convention */
export const FeatureFlagsSchema = z.object({
  "Enable Left Sidebar": z.boolean().default(false),
});

export const GlobalSettingsSchema = z.object({
  "Left Sidebar": z.object({
    Children: z.array(z.string()).default([]),
    Settings: z.object({
      Collapsable: z.boolean().default(false),
      Folded: z.boolean().default(false),
    }),
  }),
});
/* eslint-disable @typescript-eslint/naming-convention */

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>;
