import { z } from "zod";

const idAndName = z.object({
  id: z.string().max(200),
  name: z.string().max(200),
});

export const TutorialRequestSchema = z.object({
  goal: z.string().trim().min(3).max(500),
  newToObsidian: z.boolean(),
  pluginVersion: z.string().max(40),
  vault: z.object({
    nodeTypes: z.array(z.string().max(100)).max(50),
    relationTypes: z.array(z.string().max(100)).max(50),
    commands: z.array(idAndName).max(1000),
    settingTabs: z.array(idAndName).max(200),
    ribbonLabels: z.array(z.string().max(100)).max(50),
  }),
  // The plugin owns the block library, so it sends what it can back on this version.
  blocks: z
    .array(
      z.object({
        id: z.string().max(100),
        description: z.string().max(500),
        completesWhen: z.string().max(300),
        params: z.array(z.string().max(50)).max(5),
      }),
    )
    .max(50),
});

export type TutorialRequest = z.infer<typeof TutorialRequestSchema>;

const stepBase = {
  title: z.string(),
  body: z.string(),
  basics: z.boolean(),
};

const ModelStepSchema = z.discriminatedUnion("kind", [
  z.object({
    ...stepBase,
    kind: z.literal("block"),
    block: z.string(),
    params: z.array(z.object({ name: z.string(), value: z.string() })),
  }),
  z.object({ ...stepBase, kind: z.literal("command"), commandId: z.string() }),
  z.object({ ...stepBase, kind: z.literal("ribbon"), label: z.string() }),
  z.object({ ...stepBase, kind: z.literal("settings-tab"), tabId: z.string() }),
  z.object({ ...stepBase, kind: z.literal("text") }),
]);

export const ModelTutorialSchema = z.object({
  title: z.string(),
  steps: z.array(ModelStepSchema).min(1),
});

export type ModelTutorial = z.infer<typeof ModelTutorialSchema>;
export type ModelStep = z.infer<typeof ModelStepSchema>;

const stepVariant = (
  kind: string,
  fields: Record<string, unknown>,
): Record<string, unknown> => ({
  type: "object",
  properties: {
    kind: { const: kind },
    title: { type: "string" },
    body: { type: "string" },
    basics: { type: "boolean" },
    ...fields,
  },
  required: ["kind", "title", "body", "basics", ...Object.keys(fields)],
  additionalProperties: false,
});

// Structured outputs require additionalProperties: false, so block params are name/value pairs, not a map.
export const MODEL_TUTORIAL_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" },
    steps: {
      type: "array",
      items: {
        anyOf: [
          stepVariant("block", {
            block: { type: "string" },
            params: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  value: { type: "string" },
                },
                required: ["name", "value"],
                additionalProperties: false,
              },
            },
          }),
          stepVariant("command", { commandId: { type: "string" } }),
          stepVariant("ribbon", { label: { type: "string" } }),
          stepVariant("settings-tab", { tabId: { type: "string" } }),
          stepVariant("text", {}),
        ],
      },
    },
  },
  required: ["title", "steps"],
  additionalProperties: false,
};
