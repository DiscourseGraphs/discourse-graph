import { z } from "zod";

/* eslint-disable @typescript-eslint/naming-convention */
export const FeatureFlagsSchema = z.object({
  "Enable Left Sidebar": z.boolean().default(false),
});

export const GlobalSettingsSchema = z.object({
  "Left Sidebar": z
    .object({
      Children: z.array(z.string()).default([]),
      Settings: z
        .object({
          Collapsable: z.boolean().default(false),
          Folded: z.boolean().default(false),
        })
        .default({}),
    })
    .default({}),
});

export const PersonalSectionSchema = z.object({
  Children: z
    .array(
      z.object({
        Page: z.string(),
        Alias: z.string().default(""),
      }),
    )
    .default([]),
  Settings: z
    .object({
      "Truncate-result?": z.number().default(75),
      Folded: z.boolean().default(false),
    })
    .default({}),
});

export const PersonalSettingsSchema = z.object({
  "Left Sidebar": z.record(z.string(), PersonalSectionSchema).default({}),
});
/* eslint-enable @typescript-eslint/naming-convention */

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>;
export type PersonalSection = z.infer<typeof PersonalSectionSchema>;
export type PersonalSettings = z.infer<typeof PersonalSettingsSchema>;
