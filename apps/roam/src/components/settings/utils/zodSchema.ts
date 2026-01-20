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

export const SuggestiveRulesSchema = z.lazy(() =>
  z.object({
    template: z.array(RoamNodeSchema).default([]),
    embeddingRef: z.string().optional(),
    isFirstChild: z
      .object({
        uid: z.string(),
        value: z.boolean(),
      })
      .optional(),
  }),
);

export const AttributesSchema = z.record(z.string(), z.string()).default({});

const QBClauseDataSchema = z.object({
  source: z.string(),
  relation: z.string(),
  target: z.string(),
  not: z.boolean().optional(),
});

type Condition =
  | (z.infer<typeof QBClauseDataSchema> & { type: "clause" })
  | (z.infer<typeof QBClauseDataSchema> & { type: "not" })
  | { type: "or"; conditions: Condition[][] }
  | { type: "not or"; conditions: Condition[][] };

export const ConditionSchema: z.ZodType<Condition> = z.discriminatedUnion(
  "type",
  [
    QBClauseDataSchema.extend({ type: z.literal("clause") }),
    QBClauseDataSchema.extend({ type: z.literal("not") }),
    z.object({
      type: z.literal("or"),
      conditions: z.lazy(() => ConditionSchema.array().array()),
    }),
    z.object({
      type: z.literal("not or"),
      conditions: z.lazy(() => ConditionSchema.array().array()),
    }),
  ],
);

export const SelectionSchema = z.object({
  text: z.string(),
  label: z.string(),
});

type RoamNode = {
  text: string;
  children?: RoamNode[];
  uid?: string;
  heading?: 0 | 1 | 2 | 3;
  open?: boolean;
};

export const RoamNodeSchema: z.ZodType<RoamNode> = z.lazy(() =>
  z.object({
    text: z.string(),
    children: RoamNodeSchema.array().optional(),
    uid: z.string().optional(),
    heading: z
      .union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
      .optional(),
    open: z.boolean().optional(),
  }),
);

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
    .array(ConditionSchema)
    .nullable()
    .optional()
    .transform((val) => val ?? []),
  template: z
    .array(RoamNodeSchema)
    .nullable()
    .optional()
    .transform((val) => val ?? []),
  canvasSettings: CanvasSettingsSchema.partial().nullable().optional(),
  graphOverview: booleanWithDefault(false),
  attributes: z
    .record(z.string(), z.string())
    .nullable()
    .optional()
    .transform((val) => val ?? {}),
  overlay: stringWithDefault(""),
  index: z
    .object({
      conditions: z.array(ConditionSchema).default([]),
      selections: z.array(SelectionSchema).default([]),
    })
    .nullable()
    .optional(),
  suggestiveRules: SuggestiveRulesSchema.nullable().optional(),
  embeddingRef: stringWithDefault(""),
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

export const TripleSchema = z.tuple([z.string(), z.string(), z.string()]);

export const RelationConditionSchema = z.object({
  triples: z.array(TripleSchema).default([]),
  nodePositions: z.record(z.string(), z.string()).default({}),
});

export const DiscourseRelationSchema = z.object({
  id: z.string(),
  label: z.string(),
  source: z.string(),
  destination: z.string(),
  complement: z.string().default(""),
  ifConditions: z.array(RelationConditionSchema).default([]),
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
  Trigger: z.string().default("\\"),
  "Canvas Page Format": z.string().default("Canvas/*"),
  "Left Sidebar": LeftSidebarGlobalSettingsSchema.default({}),
  Export: ExportSettingsSchema.default({}),
  "Suggestive Mode": SuggestiveModeGlobalSettingsSchema.default({}),
  Relations: z.array(DiscourseRelationSchema).default([]),
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

export const StoredFiltersSchema = z.object({
  includes: z.object({ values: z.array(z.string()).default([]) }).default({}),
  excludes: z.object({ values: z.array(z.string()).default([]) }).default({}),
});

export const QuerySettingsSchema = z.object({
  "Hide Query Metadata": z.boolean().default(false),
  "Default Page Size": z.number().default(10),
  "Query Pages": z.array(z.string()).default([]),
  "Default Filters": z.record(z.string(), StoredFiltersSchema).default({}),
});

export const PersonalSettingsSchema = z.object({
  "Left Sidebar": LeftSidebarPersonalSettingsSchema,
  "Personal Node Menu Trigger": z
    .object({ key: z.string(), modifiers: z.number() })
    .default({ key: "", modifiers: 0 }),
  "Node Search Menu Trigger": z.string().default("@"),
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

/* eslint-enable @typescript-eslint/naming-convention */

export type CanvasSettings = z.infer<typeof CanvasSettingsSchema>;
export type SuggestiveRules = z.infer<typeof SuggestiveRulesSchema>;
export type DiscourseNodeSettings = z.infer<typeof DiscourseNodeSchema>;
export type Triple = z.infer<typeof TripleSchema>;
export type RelationCondition = z.infer<typeof RelationConditionSchema>;
export type DiscourseRelationSettings = z.infer<typeof DiscourseRelationSchema>;
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
export type StoredFilters = z.infer<typeof StoredFiltersSchema>;
export type QuerySettings = z.infer<typeof QuerySettingsSchema>;
export type PersonalSettings = z.infer<typeof PersonalSettingsSchema>;
export type GithubSettings = z.infer<typeof GithubSettingsSchema>;
export type QueryCondition = z.infer<typeof ConditionSchema>;
export type QuerySelection = z.infer<typeof SelectionSchema>;
export type RoamNodeType = z.infer<typeof RoamNodeSchema>;
