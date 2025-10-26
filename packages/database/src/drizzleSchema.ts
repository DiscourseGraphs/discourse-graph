// A drizzle schema definition for the supabase schema.
// It describes as much of the supabase schema as drizzle understands,
// notably excluding composite types, functions and triggers, comments.

import {
  pgTable,
  pgSchema,
  uniqueIndex,
  index,
  foreignKey,
  pgPolicy,
  bigint,
  varchar,
  boolean,
  jsonb,
  uuid,
  text,
  timestamp,
  smallint,
  vector,
  serial,
  check,
  primaryKey,
  customType,
  pgView,
  pgSequence,
  pgEnum,
  pgRole,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const anon = pgRole('anon').existing();
export const authenticated = pgRole('authenticated').existing();
// Also missing: Ability to revoke access to anon.

export const agentIdentifierType = pgEnum("AgentIdentifierType", [
  "email",
  "orcid",
]);
export const agentType = pgEnum("AgentType", [
  "person",
  "organization",
  "automated_agent",
  "anonymous",
]);
export const contentVariant = pgEnum("ContentVariant", [
  "direct",
  "direct_and_children",
  "direct_and_description",
]);
export const embeddingName = pgEnum("EmbeddingName", [
  "openai_text_embedding_ada2_1536",
  "openai_text_embedding_3_small_512",
  "openai_text_embedding_3_small_1536",
  "openai_text_embedding_3_large_256",
  "openai_text_embedding_3_large_1024",
  "openai_text_embedding_3_large_3072",
]);
export const entityType = pgEnum("EntityType", [
  "Platform",
  "Space",
  "PlatformAccount",
  "Person",
  "AutomatedAgent",
  "Document",
  "Content",
  "Concept",
  "ConceptSchema",
  "ContentLink",
  "Occurrence",
]);
export const epistemicStatus = pgEnum("EpistemicStatus", [
  "certainly_not",
  "strong_evidence_against",
  "could_be_false",
  "unknown",
  "uncertain",
  "contentious",
  "could_be_true",
  "strong_evidence_for",
  "certain",
]);
export const platform = pgEnum("Platform", ["Roam", "Obsidian"]);
export const scale = pgEnum("Scale", [
  "document",
  "post",
  "chunk_unit",
  "section",
  "block",
  "field",
  "paragraph",
  "quote",
  "sentence",
  "phrase",
]);
export const taskStatus = pgEnum("task_status", [
  "active",
  "timeout",
  "complete",
  "failed",
]);

export const entityIdSeq = pgSequence("entity_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "9223372036854775807",
  cache: "1",
  cycle: false,
});

const oid = customType<{data: number}>({dataType() {return 'oid';}});

// The user table in the auth schema provided by supabase. Do not edit.
// Ideally I should be able to mark it as existing so drizzle does not try to maintain it.
export const authSchemaUsers = pgSchema("auth").table("users", {
  id: uuid().primaryKey(),
  instanceId: uuid("instance_id"),
  role: text(),
  email: text(),
  phone: text(),
  encryptedPassword: text("encrypted_password"),
  emailConfirmedAt: timestamp("email_confirmend_at", { mode: "string" }),
  phoneConfirmedAt: timestamp("phone_confirmend_at", { mode: "string" }),
  confirmedAt: timestamp("confirmend_at", { mode: "string" }).generatedAlwaysAs(
    sql`LEAST(email_confirmed_at, phone_confirmed_at)`,
  ),
  // etc. Not trying to be exhaustive.
});

// Note: All bigint are now marked mode: "number", which is valid up to 2**31. After that we would need to shift to mode: "bigint".

export const platformAccount = pgTable(
  "PlatformAccount",
  {
    id: bigint({ mode: "number" })
      .default(sql`nextval('entity_id_seq'::regclass)`)
      .primaryKey()
      .notNull(),
    name: varchar().notNull(),
    platform: platform().notNull(),
    writePermission: boolean("write_permission").default(true).notNull(),
    active: boolean().default(true).notNull(),
    agentType: agentType("agent_type").default("person").notNull(),
    metadata: jsonb().default({}).notNull(),
    dgAccount: uuid("dg_account"),
    accountLocalId: varchar("account_local_id").notNull(),
  },
  (table) => [
    uniqueIndex("account_platform_and_id_idx").using(
      "btree",
      table.accountLocalId.asc().nullsLast(),
      table.platform.asc().nullsLast(),
    ),
    index("platform_account_dg_account_idx").using(
      "btree",
      table.dgAccount.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.dgAccount],
      foreignColumns: [authSchemaUsers.id],
      name: "PlatformAccount_dg_account_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    pgPolicy("platform_account_delete_policy", {
      as: "permissive",
      for: "delete",
      to: ["public"],
      using: sql`((dg_account = ( SELECT auth.uid() AS uid LIMIT 1)) OR ((dg_account IS NULL) AND unowned_account_in_shared_space(id)))`,
    }),
    pgPolicy("platform_account_insert_policy", {
      as: "permissive",
      for: "insert",
      to: ["public"],
      withCheck: sql`((dg_account = ( SELECT auth.uid() AS uid LIMIT 1)) OR ((dg_account IS NULL) AND unowned_account_in_shared_space(id)))`,
    }),
    pgPolicy("platform_account_select_policy", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`((dg_account = ( SELECT auth.uid() AS uid LIMIT 1)) OR account_in_shared_space(id))`,
    }),
    pgPolicy("platform_account_update_policy", {
      as: "permissive",
      for: "update",
      to: ["public"],
      withCheck: sql`((dg_account = ( SELECT auth.uid() AS uid LIMIT 1)) OR ((dg_account IS NULL) AND unowned_account_in_shared_space(id)))`,
    }),
  ],
);

export const space = pgTable(
  "Space",
  {
    id: bigint({ mode: "number" })
      .default(sql`nextval('entity_id_seq'::regclass)`)
      .primaryKey()
      .notNull(),
    url: varchar().notNull(),
    name: varchar().notNull(),
    platform: platform().notNull(),
  },
  (table) => [
    uniqueIndex("space_url_idx").using("btree", table.url.asc().nullsLast()),
    pgPolicy("space_insert_policy", {
      as: "permissive",
      for: "insert",
      to: ["public"],
      withCheck: sql`true`,
    }),
    pgPolicy("space_policy", {
      as: "permissive",
      for: "all",
      to: ["public"],
      using: sql`in_space(id)`,
    }),
  ],
);

export const concept = pgTable(
  "Concept",
  {
    id: bigint({ mode: "number" })
      .default(sql`nextval('entity_id_seq'::regclass)`)
      .primaryKey()
      .notNull(),
    epistemicStatus: epistemicStatus("epistemic_status")
      .default("unknown")
      .notNull(),
    name: varchar().notNull(),
    description: text(),
    authorId: bigint("author_id", { mode: "number" }),
    created: timestamp({ mode: "string" }).notNull(),
    lastModified: timestamp("last_modified", { mode: "string" }).notNull(),
    spaceId: bigint("space_id", { mode: "number" }).notNull(),
    schemaId: bigint("schema_id", { mode: "number" }),
    literalContent: jsonb("literal_content").default({}).notNull(),
    isSchema: boolean("is_schema").default(false).notNull(),
    representedById: bigint("represented_by_id", { mode: "number" }),
    referenceContent: jsonb("reference_content").default({}).notNull(),
    refs: bigint({ mode: "number" })
      .array()
      .notNull()
      .generatedAlwaysAs(sql`extract_references(reference_content)`),
    arity: smallint().generatedAlwaysAs(
      sql`compute_arity_local(schema_id, literal_content)`,
    ),
  },
  (table) => [
    uniqueIndex("Concept_represented_by").using(
      "btree",
      table.representedById.asc().nullsLast(),
    ),
    index("Concept_schema").using("btree", table.schemaId.asc().nullsLast()),
    index("Concept_space").using("btree", table.spaceId.asc().nullsLast()),
    index("concept_literal_content_idx").using(
      "gin",
      table.literalContent.asc().nullsLast().op("jsonb_ops"),
    ),
    index("concept_refs_idx").using("gin", table.refs.asc().nullsLast()),
    uniqueIndex("concept_space_and_name_idx").using(
      "btree",
      table.spaceId.asc().nullsLast(),
      table.name.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.spaceId],
      foreignColumns: [space.id],
      name: "Concept_space_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.schemaId],
      foreignColumns: [table.id],
      name: "Concept_schema_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.representedById],
      foreignColumns: [content.id],
      name: "Concept_represented_by_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [platformAccount.id],
      name: "Concept_author_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    pgPolicy("concept_policy", {
      as: "permissive",
      for: "all",
      to: ["public"],
      using: sql`in_space(space_id)`,
    }),
  ],
);

export const document = pgTable(
  "Document",
  {
    id: bigint({ mode: "number" })
      .default(sql`nextval('entity_id_seq'::regclass)`)
      .primaryKey()
      .notNull(),
    spaceId: bigint("space_id", { mode: "number" }),
    sourceLocalId: varchar("source_local_id"),
    url: varchar(),
    created: timestamp({ mode: "string" }).notNull(),
    metadata: jsonb().default({}).notNull(),
    lastModified: timestamp("last_modified", { mode: "string" }).notNull(),
    authorId: bigint("author_id", { mode: "number" }).notNull(),
    contents: oid(),
  },
  (table) => [
    uniqueIndex("document_space_and_local_id_idx").using(
      "btree",
      table.spaceId.asc().nullsLast(),
      table.sourceLocalId.asc().nullsLast(),
    ),
    uniqueIndex("document_url_idx").using("btree", table.url.asc().nullsLast()),
    foreignKey({
      columns: [table.spaceId],
      foreignColumns: [space.id],
      name: "Document_space_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [platformAccount.id],
      name: "Document_author_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("document_policy", {
      as: "permissive",
      for: "all",
      to: ["public"],
      using: sql`in_space(space_id)`,
    }),
  ],
);

export const contentEmbeddingOpenaiTextEmbedding3Small1536 = pgTable(
  "ContentEmbedding_openai_text_embedding_3_small_1536",
  {
    targetId: bigint("target_id", { mode: "number" }).primaryKey().notNull(),
    model: embeddingName()
      .default("openai_text_embedding_3_small_1536")
      .notNull(),
    vector: vector({ dimensions: 1536 }).notNull(),
    obsolete: boolean().default(false),
  },
  (table) => [
    foreignKey({
      columns: [table.targetId],
      foreignColumns: [content.id],
      name: "ContentEmbedding_openai_text_embedding_3_small_1_target_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("embedding_openai_te3s_1536_policy", {
      as: "permissive",
      for: "all",
      to: ["public"],
      using: sql`content_in_space(target_id)`,
    }),
  ],
);

export const content = pgTable(
  "Content",
  {
    id: bigint({ mode: "number" })
      .default(sql`nextval('entity_id_seq'::regclass)`)
      .primaryKey()
      .notNull(),
    documentId: bigint("document_id", { mode: "number" }).notNull(),
    sourceLocalId: varchar("source_local_id"),
    authorId: bigint("author_id", { mode: "number" }),
    creatorId: bigint("creator_id", { mode: "number" }),
    created: timestamp({ mode: "string" }).notNull(),
    text: text().notNull(),
    metadata: jsonb().default({}).notNull(),
    scale: scale().notNull(),
    spaceId: bigint("space_id", { mode: "number" }),
    lastModified: timestamp("last_modified", { mode: "string" }).notNull(),
    partOfId: bigint("part_of_id", { mode: "number" }),
    variant: contentVariant().default("direct").notNull(),
  },
  (table) => [
    index("Content_document").using(
      "btree",
      table.documentId.asc().nullsLast(),
    ),
    index("Content_part_of").using("btree", table.partOfId.asc().nullsLast()),
    index("Content_space").using("btree", table.spaceId.asc().nullsLast()),
    index("Content_text").using(
      "pgroonga",
      table.text.asc().nullsLast().op("pgroonga_text_full_text_search_ops_v2"),
    ),
    uniqueIndex("content_space_local_id_variant_idx").using(
      "btree",
      table.spaceId.asc().nullsLast(),
      table.sourceLocalId.asc().nullsLast(),
      table.variant.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.documentId],
      foreignColumns: [document.id],
      name: "Content_document_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.spaceId],
      foreignColumns: [space.id],
      name: "Content_space_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.partOfId],
      foreignColumns: [table.id],
      name: "Content_part_of_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [platformAccount.id],
      name: "Content_author_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [platformAccount.id],
      name: "Content_creator_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    pgPolicy("content_policy", {
      as: "permissive",
      for: "all",
      to: ["public"],
      using: sql`in_space(space_id)`,
    }),
  ],
);

export const syncInfo = pgTable(
  "sync_info",
  {
    id: serial().primaryKey().notNull(),
    syncTarget: bigint("sync_target", { mode: "number" }),
    syncFunction: varchar("sync_function", { length: 20 }),
    status: taskStatus().default("active"),
    worker: varchar({ length: 100 }).notNull(),
    failureCount: smallint("failure_count").default(0),
    lastTaskStart: timestamp("last_task_start", {
      withTimezone: true,
      mode: "string",
    }),
    lastTaskEnd: timestamp("last_task_end", {
      withTimezone: true,
      mode: "string",
    }),
    taskTimesOutAt: timestamp("task_times_out_at", {
      withTimezone: true,
      mode: "string",
    }),
    targetType: entityType("target_type").default("Space").notNull(),
  },
  (table) => [
    uniqueIndex("sync_info_u_idx").using(
      "btree",
      table.syncTarget.asc().nullsLast(),
      table.syncFunction.asc().nullsLast(),
    ),
    pgPolicy("sync_info_policy", {
      as: "permissive",
      for: "all",
      to: ["public"],
      using: sql`generic_entity_access(sync_target, target_type)`,
    }),
  ],
);

export const accessToken = pgTable(
  "access_token",
  {
    requestId: varchar("request_id").primaryKey().notNull(),
    accessToken: varchar("access_token").notNull(),
    code: varchar(),
    platformAccountId: bigint("platform_account_id", { mode: "number" }),
    createdDate: timestamp("created_date", {
      withTimezone: true,
      mode: "string",
    })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("access_token_access_token_idx").using(
      "btree",
      table.accessToken.asc().nullsLast(),
    ),
    index("access_token_code_idx").using("btree", table.code.asc().nullsLast()),
    index("access_token_platform_account_id_idx").using(
      "btree",
      table.platformAccountId.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.platformAccountId],
      foreignColumns: [platformAccount.id],
      name: "access_token_platform_account_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    pgPolicy("access_token_policy", {
      as: "permissive",
      for: "all",
      to: ["public"],
      using: sql`((platform_account_id IS NULL) OR is_my_account(platform_account_id))`,
    }),
    check("access_token_code_check", sql`code IS NOT NULL`),
  ],
);

export const conceptContributors = pgTable(
  "concept_contributors",
  {
    conceptId: bigint("concept_id", { mode: "number" }).notNull(),
    contributorId: bigint("contributor_id", { mode: "number" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.conceptId],
      foreignColumns: [concept.id],
      name: "concept_contributors_concept_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.contributorId],
      foreignColumns: [platformAccount.id],
      name: "concept_contributors_contributor_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    primaryKey({
      columns: [table.conceptId, table.contributorId],
      name: "concept_contributors_pkey",
    }),
    pgPolicy("concept_contributors_policy", {
      as: "permissive",
      for: "all",
      to: ["public"],
      using: sql`concept_in_space(concept_id)`,
    }),
  ],
);

export const contentContributors = pgTable(
  "content_contributors",
  {
    contentId: bigint("content_id", { mode: "number" }).notNull(),
    contributorId: bigint("contributor_id", { mode: "number" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.contentId],
      foreignColumns: [content.id],
      name: "content_contributors_content_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.contributorId],
      foreignColumns: [platformAccount.id],
      name: "content_contributors_contributor_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    primaryKey({
      columns: [table.contentId, table.contributorId],
      name: "content_contributors_pkey",
    }),
    pgPolicy("content_contributors_policy", {
      as: "permissive",
      for: "all",
      to: ["public"],
      using: sql`content_in_space(content_id)`,
    }),
  ],
);

export const spaceAccess = pgTable(
  "SpaceAccess",
  {
    spaceId: bigint("space_id", { mode: "number" }).notNull(),
    accountId: bigint("account_id", { mode: "number" }).notNull(),
    editor: boolean().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.spaceId],
      foreignColumns: [space.id],
      name: "SpaceAccess_space_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [platformAccount.id],
      name: "SpaceAccess_account_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    primaryKey({
      columns: [table.spaceId, table.accountId],
      name: "SpaceAccess_pkey",
    }),
    pgPolicy("space_access_delete_policy", {
      as: "permissive",
      for: "delete",
      to: ["public"],
      using: sql`(unowned_account_in_shared_space(account_id) OR (account_id = my_account()))`,
    }),
    pgPolicy("space_access_insert_policy", {
      as: "permissive",
      for: "insert",
      to: ["public"],
      withCheck: sql`(unowned_account_in_shared_space(account_id) OR (account_id = my_account()))`,
    }),
    pgPolicy("space_access_select_policy", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`in_space(space_id)`,
    }),
    pgPolicy("space_access_update_policy", {
      as: "permissive",
      for: "update",
      to: ["public"],
      withCheck: sql`(unowned_account_in_shared_space(account_id) OR (account_id = my_account()))`,
    }),
  ],
);

export const agentIdentifier = pgTable(
  "AgentIdentifier",
  {
    identifierType: agentIdentifierType("identifier_type").notNull(),
    accountId: bigint("account_id", { mode: "number" }).notNull(),
    value: varchar().notNull(),
    trusted: boolean().default(false).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [platformAccount.id],
      name: "AgentIdentifier_account_id_fkey",
    }),
    primaryKey({
      columns: [table.value, table.identifierType, table.accountId],
      name: "AgentIdentifier_pkey",
    }),
    pgPolicy("agent_identifier_delete_policy", {
      as: "permissive",
      for: "delete",
      to: ["public"],
      using: sql`(unowned_account_in_shared_space(account_id) OR (account_id = my_account()))`,
    }),
    pgPolicy("agent_identifier_insert_policy", {
      as: "permissive",
      for: "insert",
      to: ["public"],
      withCheck: sql`(unowned_account_in_shared_space(account_id) OR (account_id = my_account()))`,
    }),
    pgPolicy("agent_identifier_select_policy", {
      as: "permissive",
      for: "select",
      to: ["public"],
      using: sql`account_in_shared_space(account_id)`,
    }),
    pgPolicy("agent_identifier_update_policy", {
      as: "permissive",
      for: "update",
      to: ["public"],
      withCheck: sql`(unowned_account_in_shared_space(account_id) OR (account_id = my_account()))`,
    }),
  ],
);
export const myContentsWithEmbeddingOpenaiTextEmbedding3Small1536 = pgView(
  "my_contents_with_embedding_openai_text_embedding_3_small_1536",
  {
    id: bigint({ mode: "number" }),
    documentId: bigint("document_id", { mode: "number" }),
    sourceLocalId: varchar("source_local_id"),
    variant: contentVariant(),
    authorId: bigint("author_id", { mode: "number" }),
    creatorId: bigint("creator_id", { mode: "number" }),
    created: timestamp({ mode: "string" }),
    text: text(),
    metadata: jsonb(),
    scale: scale(),
    spaceId: bigint("space_id", { mode: "number" }),
    lastModified: timestamp("last_modified", { mode: "string" }),
    partOfId: bigint("part_of_id", { mode: "number" }),
    model: embeddingName(),
    vector: vector({ dimensions: 1536 }),
  },
).as(
  sql`SELECT ct.id, ct.document_id, ct.source_local_id, ct.variant, ct.author_id, ct.creator_id, ct.created, ct.text, ct.metadata, ct.scale, ct.space_id, ct.last_modified, ct.part_of_id, emb.model, emb.vector FROM "Content" ct JOIN "ContentEmbedding_openai_text_embedding_3_small_1536" emb ON ct.id = emb.target_id WHERE (ct.space_id = ANY (my_space_ids())) AND NOT emb.obsolete`,
);

export const myConcepts = pgView("my_concepts", {
  id: bigint({ mode: "number" }),
  epistemicStatus: epistemicStatus("epistemic_status"),
  name: varchar(),
  description: text(),
  authorId: bigint("author_id", { mode: "number" }),
  created: timestamp({ mode: "string" }),
  lastModified: timestamp("last_modified", { mode: "string" }),
  spaceId: bigint("space_id", { mode: "number" }),
  arity: smallint(),
  schemaId: bigint("schema_id", { mode: "number" }),
  literalContent: jsonb("literal_content"),
  referenceContent: jsonb("reference_content"),
  refs: bigint({ mode: "number" }),
  isSchema: boolean("is_schema"),
  representedById: bigint("represented_by_id", { mode: "number" }),
}).as(
  sql`SELECT id, epistemic_status, name, description, author_id, created, last_modified, space_id, arity, schema_id, literal_content, reference_content, refs, is_schema, represented_by_id FROM "Concept" WHERE space_id = ANY (my_space_ids())`,
);

export const mySpaces = pgView("my_spaces", {
  id: bigint({ mode: "number" }),
  url: varchar(),
  name: varchar(),
  platform: platform(),
}).as(
  sql`SELECT id, url, name, platform FROM "Space" WHERE id = ANY (my_space_ids())`,
);

export const myAccounts = pgView("my_accounts", {
  id: bigint({ mode: "number" }),
  name: varchar(),
  platform: platform(),
  accountLocalId: varchar("account_local_id"),
  writePermission: boolean("write_permission"),
  active: boolean(),
  agentType: agentType("agent_type"),
  metadata: jsonb(),
  dgAccount: uuid("dg_account"),
}).as(
  sql`SELECT id, name, platform, account_local_id, write_permission, active, agent_type, metadata, dg_account FROM "PlatformAccount" pa WHERE (EXISTS ( SELECT 1 FROM "SpaceAccess" sa WHERE sa.account_id = pa.id AND (sa.space_id = ANY (my_space_ids()))))`,
);

export const myDocuments = pgView("my_documents", {
  id: bigint({ mode: "number" }),
  spaceId: bigint("space_id", { mode: "number" }),
  sourceLocalId: varchar("source_local_id"),
  url: varchar(),
  created: timestamp({ mode: "string" }),
  metadata: jsonb(),
  lastModified: timestamp("last_modified", { mode: "string" }),
  authorId: bigint("author_id", { mode: "number" }),
  contents: oid(),
}).as(
  sql`SELECT id, space_id, source_local_id, url, created, metadata, last_modified, author_id, contents FROM "Document" WHERE space_id = ANY (my_space_ids())`,
);

export const myContents = pgView("my_contents", {
  id: bigint({ mode: "number" }),
  documentId: bigint("document_id", { mode: "number" }),
  sourceLocalId: varchar("source_local_id"),
  variant: contentVariant(),
  authorId: bigint("author_id", { mode: "number" }),
  creatorId: bigint("creator_id", { mode: "number" }),
  created: timestamp({ mode: "string" }),
  text: text(),
  metadata: jsonb(),
  scale: scale(),
  spaceId: bigint("space_id", { mode: "number" }),
  lastModified: timestamp("last_modified", { mode: "string" }),
  partOfId: bigint("part_of_id", { mode: "number" }),
}).as(
  sql`SELECT id, document_id, source_local_id, variant, author_id, creator_id, created, text, metadata, scale, space_id, last_modified, part_of_id FROM "Content" WHERE space_id = ANY (my_space_ids())`,
);
