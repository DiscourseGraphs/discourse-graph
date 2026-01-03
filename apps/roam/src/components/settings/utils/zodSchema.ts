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

const stringWithDefault = (defaultVal: string) =>
  z
    .string()
    .nullable()
    .optional()
    .transform((val) => val ?? defaultVal);

const booleanWithDefault = (defaultVal: boolean) =>
  z
    .boolean()
    .nullable()
    .optional()
    .transform((val) => val ?? defaultVal);

export const DiscourseNodeSchema = z.object({
  text: z.string(),
  type: z.string(),
  format: stringWithDefault(""),
  shortcut: stringWithDefault(""),
  tag: stringWithDefault(""),
  description: stringWithDefault(""),
  specification: z
    .array(z.unknown())
    .nullable()
    .optional()
    .transform((val) => val ?? []),
  specificationUid: stringWithDefault(""),
  template: z
    .array(z.unknown())
    .nullable()
    .optional()
    .transform((val) => val ?? []),
  templateUid: stringWithDefault(""),
  canvasSettings: z
    .record(z.string(), z.string())
    .nullable()
    .optional()
    .transform((val) => val ?? {}),
  graphOverview: booleanWithDefault(false),
  attributes: z
    .record(z.string(), z.string())
    .nullable()
    .optional()
    .transform((val) => val ?? {}),
  overlay: stringWithDefault(""),
  index: z.unknown().nullable().optional(),
  indexUid: stringWithDefault(""),
  suggestiveRules: SuggestiveRulesSchema.nullable().optional(),
  embeddingRef: stringWithDefault(""),
  embeddingRefUid: stringWithDefault(""),
  isFirstChild: z
    .object({
      uid: z.string(),
      value: z.boolean(),
    })
    .nullable()
    .optional(),
  backedBy: z
    .enum(["user", "default", "relation"])
    .nullable()
    .transform((val) => val ?? "user"),
});

export const FeatureFlagsSchema = z.object({
  "Enable Left Sidebar": z.boolean().default(false),
  "Suggestive Mode Enabled": z.boolean().default(false),
  "Reified Relation Triples": z.boolean().default(false),
});

export const ExportSettingsSchema = z.object({
  "Remove Special Characters": z.boolean().default(false),
  "Resolve Block References": z.boolean().default(false),
  "Resolve Block Embeds": z.boolean().default(false),
  "Append Referenced Node": z.boolean().default(false),
  "Link Type": z.enum(["alias", "wikilinks", "roam url"]).default("alias"),
  "Max Filename Length": z.number().default(64),
  Frontmatter: z.array(z.string()).default([]),
});

export const PageGroupSchema = z.object({
  name: z.string(),
  pages: z.array(z.string()).default([]),
});

export const SuggestiveModeGlobalSettingsSchema = z.object({
  "Include Current Page Relations": z.boolean().default(false),
  "Include Parent And Child Blocks": z.boolean().default(false),
  "Page Groups": z.array(PageGroupSchema).default([]),
});

export const LeftSidebarGlobalSettingsSchema = z.object({
  Children: z.array(z.string()).default([]),
  Settings: z
    .object({
      Collapsable: z.boolean().default(false),
      Folded: z.boolean().default(false),
    })
    .default({}),
});

export const GlobalSettingsSchema = z.object({
  Trigger: z.string().default(""),
  "Canvas Page Format": z.string().default(""),
  "Left Sidebar": LeftSidebarGlobalSettingsSchema.default({}),
  Export: ExportSettingsSchema.default({}),
  "Suggestive Mode": SuggestiveModeGlobalSettingsSchema.default({}),
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

export const LeftSidebarPersonalSettingsSchema = z
  .record(z.string(), PersonalSectionSchema)
  .default({});

export const QueryFilterSchema = z.object({
  includes: z.boolean().default(true),
  key: z.string(),
  value: z.string(),
});

export const QuerySettingsSchema = z.object({
  "Hide Query Metadata": z.boolean().default(false),
  "Default Page Size": z.number().default(10),
  "Query Pages": z.array(z.string()).default([]),
  "Default Filters": z.array(QueryFilterSchema).default([]),
});

export const PersonalSettingsSchema = z.object({
  "Left Sidebar": LeftSidebarPersonalSettingsSchema,
  "Personal Node Menu Trigger": z.string().default(""),
  "Node Search Menu Trigger": z.string().default(""),
  "Discourse Tool Shortcut": z.string().default(""),
  "Discourse Context Overlay": z.boolean().default(false),
  "Suggestive Mode Overlay": z.boolean().default(false),
  "Overlay in Canvas": z.boolean().default(false),
  "Text Selection Popup": z.boolean().default(true),
  "Disable Sidebar Open": z.boolean().default(false),
  "Page Preview": z.boolean().default(false),
  "Hide Feedback Button": z.boolean().default(false),
  "Streamline Styling": z.boolean().default(false),
  "Auto Canvas Relations": z.boolean().default(false),
  "Disable Product Diagnostics": z.boolean().default(false),
  Query: QuerySettingsSchema.default({}),
});

export const GithubSettingsSchema = z.object({
  "oauth-github": z.string().optional(),
  "selected-repo": z.string().optional(),
});

const RoamBlockNodeSchema: z.ZodType<RoamBlockNode> = z.lazy(() =>
  z.object({
    text: z.string(),
    children: z.array(RoamBlockNodeSchema).optional(),
  }),
);

type RoamBlockNode = {
  text: string;
  children?: RoamBlockNode[];
};

export const QueryClauseSchema = z.object({
  text: z.enum(["clause", "not"]),
  children: z.array(
    z.object({
      text: z.enum(["source", "relation", "target"]),
      children: z.array(z.object({ text: z.string() })).optional(),
    }),
  ),
});

export const QueryNestedConditionSchema = z.object({
  text: z.enum(["or", "not or"]),
  children: z.array(z.unknown()),
});

export const QuerySelectionSchema = z.object({
  text: z.string(),
  children: z.array(z.object({ text: z.string() })).optional(),
});

export const QueryCustomSchema = z.object({
  text: z.literal("custom"),
  children: z
    .tuple([
      z.object({ text: z.string() }),
      z.object({ text: z.literal("enabled") }).optional(),
    ])
    .optional(),
});

export const QueryBlockSchema = z.object({
  text: z.literal("scratch"),
  children: z.array(RoamBlockNodeSchema),
});

/* eslint-enable @typescript-eslint/naming-convention */

export type CanvasSettings = z.infer<typeof CanvasSettingsSchema>;
export type SuggestiveRules = z.infer<typeof SuggestiveRulesSchema>;
export type DiscourseNodeSettings = z.infer<typeof DiscourseNodeSchema>;
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export type ExportSettings = z.infer<typeof ExportSettingsSchema>;
export type PageGroup = z.infer<typeof PageGroupSchema>;
export type SuggestiveModeGlobalSettings = z.infer<
  typeof SuggestiveModeGlobalSettingsSchema
>;
export type LeftSidebarGlobalSettings = z.infer<
  typeof LeftSidebarGlobalSettingsSchema
>;
export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>;
export type PersonalSection = z.infer<typeof PersonalSectionSchema>;
export type LeftSidebarPersonalSettings = z.infer<
  typeof LeftSidebarPersonalSettingsSchema
>;
export type QueryFilter = z.infer<typeof QueryFilterSchema>;
export type QuerySettings = z.infer<typeof QuerySettingsSchema>;
export type PersonalSettings = z.infer<typeof PersonalSettingsSchema>;
export type GithubSettings = z.infer<typeof GithubSettingsSchema>;
export type QueryBlock = z.infer<typeof QueryBlockSchema>;
export type QueryClause = z.infer<typeof QueryClauseSchema>;
export type QuerySelection = z.infer<typeof QuerySelectionSchema>;
export type QueryCustom = z.infer<typeof QueryCustomSchema>;
export type RoamBlock = RoamBlockNode;
