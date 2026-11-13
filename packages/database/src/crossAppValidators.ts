import { supportedContentTypes } from "@repo/content-model/constants";
import { z } from "zod";
import { Constants, type Json } from "./dbTypes";
import { isRid } from "./lib/rid";

// JSON carries a Date as an ISO 8601 string. One without an offset is refused because
// `new Date` would read it in the server's local time zone.
const dateValidator = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const jsonValidator: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValidator),
    z.record(jsonValidator.optional()),
  ]),
);

// Every object validator is strict, so a key the contract does not define, such as a
// misspelled optional key, is refused instead of silently dropped. `extend` and
// `partial` keep the setting.
const crossAppBaseValidator = z
  .object({
    localId: z.string(),
    rid: z.string().refine(isRid).optional(),
    createdAt: dateValidator,
    modifiedAt: dateValidator.optional(),
    authorId: z.string(),
  })
  .strict();

const crossAppSchemaBaseValidator = crossAppBaseValidator.extend({
  metadata: jsonValidator.optional(),
});

export const crossAppNodeSchemaValidator = crossAppSchemaBaseValidator.extend({
  label: z.string(),
  template: z.string().optional(),
  templateTitle: z.string().optional(),
  format: z.string().optional(),
  slotDefinitions: z.record(z.string().optional()).optional(),
});

export const crossAppRelationTypeSchemaValidator =
  crossAppSchemaBaseValidator.extend({
    label: z.string(),
    complement: z.string(),
  });

const relationTripleEndpointsShape = {
  sourceType: z.string(),
  destinationType: z.string(),
};

export const crossAppRelationTripleSchemaValidator = z.union([
  crossAppSchemaBaseValidator.extend({
    label: z.string(),
    complement: z.string(),
    relation: z.never().optional(),
    ...relationTripleEndpointsShape,
  }),
  crossAppSchemaBaseValidator.extend({
    relation: z.string(),
    label: z.never().optional(),
    complement: z.never().optional(),
    ...relationTripleEndpointsShape,
  }),
]);

const crossAppEmbeddingValidator = z
  .object({
    value: z.array(z.number()),
    embedding: z.enum(Constants.public.Enums.EmbeddingName).optional(),
  })
  .strict();

const inlineCrossAppContentValidator = crossAppBaseValidator.partial().extend({
  value: z.string(),
  embedding: crossAppEmbeddingValidator.optional(),
  scale: z.enum(Constants.public.Enums.Scale).optional(),
  contentType: z.enum(supportedContentTypes).optional(),
});

const crossAppAssetValidator = z
  .object({
    sourceRef: z.string(),
    contentHash: z.string(),
    sourcePath: z.string().optional(),
  })
  .strict();

export const crossAppNodeValidator = crossAppBaseValidator.extend({
  nodeType: z.string(),
  coreTitle: z.string(),
  slots: z.record(z.string()).optional(),
  content: z
    .object({
      direct: inlineCrossAppContentValidator,
      directAndDescription: inlineCrossAppContentValidator.optional(),
      full: inlineCrossAppContentValidator
        .extend({ contentType: z.enum(supportedContentTypes) })
        .optional(),
    })
    .strict(),
  assets: z.array(crossAppAssetValidator).optional(),
});

export const crossAppRelationValidator = crossAppBaseValidator.extend({
  relationType: z.string(),
  source: z.string(),
  destination: z.string(),
});
