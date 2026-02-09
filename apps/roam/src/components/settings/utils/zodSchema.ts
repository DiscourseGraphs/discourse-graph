import { z } from "zod";
import DEFAULT_RELATIONS_BLOCK_PROPS from "~/components/settings/data/defaultRelationsBlockProps";

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

export const IndexSchema = z.object({
  conditions: z.array(ConditionSchema).default([]),
  selections: z.array(SelectionSchema).default([]),
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
  index: IndexSchema.nullable().optional(),
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
  id: z.string().optional(),
  label: z.string(),
  source: z.string(),
  destination: z.string(),
  complement: z.string().default(""),
  ifConditions: z.array(RelationConditionSchema).default([]),
});

export const FeatureFlagsSchema = z.object({
  "Enable left sidebar": z.boolean().default(false),
  "Suggestive mode enabled": z.boolean().default(false),
  "Reified relation triples": z.boolean().default(false),
});

export const ExportSettingsSchema = z.object({
  "Remove special characters": z.boolean().default(false),
  "Resolve block references": z.boolean().default(false),
  "Resolve block embeds": z.boolean().default(false),
  "Append referenced node": z.boolean().default(false),
  "Link type": z.enum(["alias", "wikilinks", "roam url"]).default("alias"),
  "Max filename length": z.number().default(64),
  Frontmatter: z.array(z.string()).default([]),
});

export const PageGroupSchema = z.object({
  name: z.string(),
  pages: z.array(z.string()).default([]),
});

export const SuggestiveModeGlobalSettingsSchema = z.object({
  "Include current page relations": z.boolean().default(false),
  "Include parent and child blocks": z.boolean().default(false),
  "Page groups": z.array(PageGroupSchema).default([]),
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
  "Canvas page format": z.string().default("Canvas/*"),
  "Left sidebar": LeftSidebarGlobalSettingsSchema.default({}),
  Export: ExportSettingsSchema.default({}),
  "Suggestive mode": SuggestiveModeGlobalSettingsSchema.default({}),
  Relations: z
    .record(z.string(), DiscourseRelationSchema)
    .default(DEFAULT_RELATIONS_BLOCK_PROPS),
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
  "Hide query metadata": z.boolean().default(false),
  "Default page size": z.number().default(10),
  "Query pages": z.array(z.string()).default([]),
  "Default filters": z.record(z.string(), StoredFiltersSchema).default({}),
});

export const PersonalSettingsSchema = z.object({
  "Left sidebar": LeftSidebarPersonalSettingsSchema,
  "Personal node menu trigger": z.string().default(""),
  "Node search menu trigger": z.string().default("@"),
  "Discourse tool shortcut": z.string().default(""),
  "Discourse context overlay": z.boolean().default(false),
  "Suggestive mode overlay": z.boolean().default(false),
  "Overlay in canvas": z.boolean().default(false),
  "Text selection popup": z.boolean().default(true),
  "Disable sidebar open": z.boolean().default(false),
  "Page preview": z.boolean().default(false),
  "Hide feedback button": z.boolean().default(false),
  "Streamline styling": z.boolean().default(false),
  "Auto canvas relations": z.boolean().default(false),
  "Disable product diagnostics": z.boolean().default(false),
  Query: QuerySettingsSchema.default({}),
});

export const GithubSettingsSchema = z.object({
  "oauth-github": z.string().optional(),
  "selected-repo": z.string().optional(),
});

let cachedPersonalSettingsKey: string | null = null;
export const getPersonalSettingsKey = (): string => {
  if (cachedPersonalSettingsKey !== null) return cachedPersonalSettingsKey;
  cachedPersonalSettingsKey = window.roamAlphaAPI.user.uid() || "";
  return cachedPersonalSettingsKey;
};

const staticTopLevelEntries = [
  {
    propKey: "featureFlags" as const,
    key: "Feature Flags",
    schema: FeatureFlagsSchema,
  },
  {
    propKey: "global" as const,
    key: "Global",
    schema: GlobalSettingsSchema,
  },
];

export const TOP_LEVEL_BLOCK_PROP_KEYS = {
  featureFlags: "Feature Flags",
  global: "Global",
} as const;

export const getTopLevelBlockPropsConfig = () => [
  ...staticTopLevelEntries,
  { key: getPersonalSettingsKey(), schema: PersonalSettingsSchema },
];

export const DG_BLOCK_PROP_SETTINGS_PAGE_TITLE = "roam/js/discourse-graph";
export const DISCOURSE_NODE_PAGE_PREFIX = "discourse-graph/nodes/";

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
export type Index = z.infer<typeof IndexSchema>;
