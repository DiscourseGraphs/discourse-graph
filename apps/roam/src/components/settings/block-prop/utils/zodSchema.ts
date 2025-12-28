import { z } from "zod";

/* eslint-disable @typescript-eslint/naming-convention */

export const CanvasSettingsSchema = z.object({
  color: z.string().default(""),
  alias: z.string().default(""),
  "key-image": z.boolean().default(false),
  "key-image-option": z
    .enum(["first-image", "query-builder"])
    .default("first-image"),
  "query-builder-alias": z.string().default(""),
});

export const SuggestiveRulesSchema = z.object({
  template: z.array(z.unknown()).default([]),
  embeddingRef: z.string().optional(),
  embeddingRefUid: z.string().optional(),
  isFirstChild: z
    .object({
      uid: z.string(),
      value: z.boolean(),
    })
    .optional(),
});

export const AttributesSchema = z.record(z.string(), z.string()).default({});

export const DiscourseNodeSchema = z.object({
  text: z.string(),
  type: z.string(),
  format: z.string().default(""),
  shortcut: z.string().default(""),
  tag: z.string().optional(),
  description: z.string().optional(),
  specification: z.array(z.unknown()).default([]),
  template: z.array(z.unknown()).optional(),
  canvasSettings: z.record(z.string(), z.string()).default({}),
  graphOverview: z.boolean().optional(),
  attributes: AttributesSchema,
  overlay: z.string().optional(),
  index: z.unknown().optional(),
  suggestiveRules: SuggestiveRulesSchema.optional(),
  embeddingRef: z.string().optional(),
  embeddingRefUid: z.string().optional(),
  isFirstChild: z
    .object({
      uid: z.string(),
      value: z.boolean(),
    })
    .optional(),
  backedBy: z.enum(["user", "default", "relation"]).default("user"),
});


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

export type CanvasSettings = z.infer<typeof CanvasSettingsSchema>;
export type SuggestiveRules = z.infer<typeof SuggestiveRulesSchema>;
export type DiscourseNodeSettings = z.infer<typeof DiscourseNodeSchema>;
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>;
export type PersonalSection = z.infer<typeof PersonalSectionSchema>;
export type PersonalSettings = z.infer<typeof PersonalSettingsSchema>;
