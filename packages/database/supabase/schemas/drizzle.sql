CREATE TYPE "public"."AgentIdentifierType" AS ENUM('email', 'orcid');
CREATE TYPE "public"."AgentType" AS ENUM('person', 'organization', 'automated_agent', 'anonymous');
CREATE TYPE "public"."ContentVariant" AS ENUM('direct', 'direct_and_children', 'direct_and_description');
CREATE TYPE "public"."EmbeddingName" AS ENUM('openai_text_embedding_ada2_1536', 'openai_text_embedding_3_small_512', 'openai_text_embedding_3_small_1536', 'openai_text_embedding_3_large_256', 'openai_text_embedding_3_large_1024', 'openai_text_embedding_3_large_3072');
CREATE TYPE "public"."EpistemicStatus" AS ENUM('certainly_not', 'strong_evidence_against', 'could_be_false', 'unknown', 'uncertain', 'contentious', 'could_be_true', 'strong_evidence_for', 'certain');
CREATE TYPE "public"."Platform" AS ENUM('Roam', 'Obsidian');
CREATE TYPE "public"."Scale" AS ENUM('document', 'post', 'chunk_unit', 'section', 'block', 'field', 'paragraph', 'quote', 'sentence', 'phrase');
CREATE TYPE "public"."task_status" AS ENUM('active', 'timeout', 'complete', 'failed');
CREATE SEQUENCE "public"."entity_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;
CREATE TABLE "access_token" (
	"request_id" varchar PRIMARY KEY NOT NULL,
	"access_token" varchar NOT NULL,
	"code" varchar,
	"platform_account_id" bigint,
	"created_date" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
	CONSTRAINT "access_token_code_check" CHECK (code IS NOT NULL)
);

ALTER TABLE "access_token" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "AgentIdentifier" (
	"identifier_type" "AgentIdentifierType" NOT NULL,
	"account_id" bigint NOT NULL,
	"value" varchar NOT NULL,
	"trusted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "AgentIdentifier_pkey" PRIMARY KEY("value","identifier_type","account_id")
);

ALTER TABLE "AgentIdentifier" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "Concept" (
	"id" bigint PRIMARY KEY DEFAULT nextval('entity_id_seq'::regclass) NOT NULL,
	"epistemic_status" "EpistemicStatus" DEFAULT 'unknown' NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"author_id" bigint,
	"created" timestamp NOT NULL,
	"last_modified" timestamp NOT NULL,
	"space_id" bigint NOT NULL,
	"schema_id" bigint,
	"literal_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_schema" boolean DEFAULT false NOT NULL,
	"represented_by_id" bigint,
	"reference_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"refs" bigint[] GENERATED ALWAYS AS (extract_references(reference_content)) STORED NOT NULL,
	"arity" smallint GENERATED ALWAYS AS (compute_arity_local(schema_id, literal_content)) STORED
);

ALTER TABLE "Concept" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "concept_contributors" (
	"concept_id" bigint NOT NULL,
	"contributor_id" bigint NOT NULL,
	CONSTRAINT "concept_contributors_pkey" PRIMARY KEY("concept_id","contributor_id")
);

ALTER TABLE "concept_contributors" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "Content" (
	"id" bigint PRIMARY KEY DEFAULT nextval('entity_id_seq'::regclass) NOT NULL,
	"document_id" bigint NOT NULL,
	"source_local_id" varchar,
	"author_id" bigint,
	"creator_id" bigint,
	"created" timestamp NOT NULL,
	"text" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scale" "Scale" NOT NULL,
	"space_id" bigint,
	"last_modified" timestamp NOT NULL,
	"part_of_id" bigint,
	"variant" "ContentVariant" DEFAULT 'direct' NOT NULL
);

ALTER TABLE "Content" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "content_contributors" (
	"content_id" bigint NOT NULL,
	"contributor_id" bigint NOT NULL,
	CONSTRAINT "content_contributors_pkey" PRIMARY KEY("content_id","contributor_id")
);

ALTER TABLE "content_contributors" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "ContentEmbedding_openai_text_embedding_3_small_1536" (
	"target_id" bigint PRIMARY KEY NOT NULL,
	"model" "EmbeddingName" DEFAULT 'openai_text_embedding_3_small_1536' NOT NULL,
	"vector" vector(1536) NOT NULL,
	"obsolete" boolean DEFAULT false
);

ALTER TABLE "ContentEmbedding_openai_text_embedding_3_small_1536" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "Document" (
	"id" bigint PRIMARY KEY DEFAULT nextval('entity_id_seq'::regclass) NOT NULL,
	"space_id" bigint,
	"source_local_id" varchar,
	"url" varchar,
	"created" timestamp NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_modified" timestamp NOT NULL,
	"author_id" bigint NOT NULL,
	"contents" "oid"
);

ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "PlatformAccount" (
	"id" bigint PRIMARY KEY DEFAULT nextval('entity_id_seq'::regclass) NOT NULL,
	"name" varchar NOT NULL,
	"platform" "Platform" NOT NULL,
	"write_permission" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"agent_type" "AgentType" DEFAULT 'person' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dg_account" uuid,
	"account_local_id" varchar NOT NULL
);

ALTER TABLE "PlatformAccount" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "Space" (
	"id" bigint PRIMARY KEY DEFAULT nextval('entity_id_seq'::regclass) NOT NULL,
	"url" varchar NOT NULL,
	"name" varchar NOT NULL,
	"platform" "Platform" NOT NULL
);

ALTER TABLE "Space" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "SpaceAccess" (
	"space_id" bigint NOT NULL,
	"account_id" bigint NOT NULL,
	"editor" boolean NOT NULL,
	CONSTRAINT "SpaceAccess_pkey" PRIMARY KEY("space_id","account_id")
);

ALTER TABLE "SpaceAccess" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "sync_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_target" bigint,
	"sync_function" varchar(20),
	"status" "task_status" DEFAULT 'active',
	"worker" varchar(100) NOT NULL,
	"failure_count" smallint DEFAULT 0,
	"last_task_start" timestamp with time zone,
	"last_task_end" timestamp with time zone,
	"task_times_out_at" timestamp with time zone,
	"target_type" "EntityType" DEFAULT 'Space' NOT NULL
);

ALTER TABLE "sync_info" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_token" ADD CONSTRAINT "access_token_platform_account_id_fkey" FOREIGN KEY ("platform_account_id") REFERENCES "public"."PlatformAccount"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "AgentIdentifier" ADD CONSTRAINT "AgentIdentifier_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."PlatformAccount"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."Space"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "public"."Concept"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_represented_by_id_fkey" FOREIGN KEY ("represented_by_id") REFERENCES "public"."Content"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."PlatformAccount"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "concept_contributors" ADD CONSTRAINT "concept_contributors_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "public"."Concept"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "concept_contributors" ADD CONSTRAINT "concept_contributors_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "public"."PlatformAccount"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Content" ADD CONSTRAINT "Content_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Content" ADD CONSTRAINT "Content_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."Space"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Content" ADD CONSTRAINT "Content_part_of_id_fkey" FOREIGN KEY ("part_of_id") REFERENCES "public"."Content"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "Content" ADD CONSTRAINT "Content_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."PlatformAccount"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "Content" ADD CONSTRAINT "Content_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."PlatformAccount"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "content_contributors" ADD CONSTRAINT "content_contributors_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."Content"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "content_contributors" ADD CONSTRAINT "content_contributors_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "public"."PlatformAccount"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "ContentEmbedding_openai_text_embedding_3_small_1536" ADD CONSTRAINT "ContentEmbedding_openai_text_embedding_3_small_1_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."Content"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Document" ADD CONSTRAINT "Document_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."Space"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Document" ADD CONSTRAINT "Document_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."PlatformAccount"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "PlatformAccount" ADD CONSTRAINT "PlatformAccount_dg_account_fkey" FOREIGN KEY ("dg_account") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "SpaceAccess" ADD CONSTRAINT "SpaceAccess_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."Space"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "SpaceAccess" ADD CONSTRAINT "SpaceAccess_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."PlatformAccount"("id") ON DELETE cascade ON UPDATE cascade;
CREATE UNIQUE INDEX "access_token_access_token_idx" ON "access_token" USING btree ("access_token");
CREATE INDEX "access_token_code_idx" ON "access_token" USING btree ("code");
CREATE INDEX "access_token_platform_account_id_idx" ON "access_token" USING btree ("platform_account_id");
CREATE UNIQUE INDEX "Concept_represented_by" ON "Concept" USING btree ("represented_by_id");
CREATE INDEX "Concept_schema" ON "Concept" USING btree ("schema_id");
CREATE INDEX "Concept_space" ON "Concept" USING btree ("space_id");
CREATE INDEX "concept_literal_content_idx" ON "Concept" USING gin ("literal_content" jsonb_ops);
CREATE INDEX "concept_refs_idx" ON "Concept" USING gin ("refs");
CREATE UNIQUE INDEX "concept_space_and_name_idx" ON "Concept" USING btree ("space_id","name");
CREATE INDEX "Content_document" ON "Content" USING btree ("document_id");
CREATE INDEX "Content_part_of" ON "Content" USING btree ("part_of_id");
CREATE INDEX "Content_space" ON "Content" USING btree ("space_id");
CREATE INDEX "Content_text" ON "Content" USING pgroonga ("text" pgroonga_text_full_text_search_ops_v2);
CREATE UNIQUE INDEX "content_space_local_id_variant_idx" ON "Content" USING btree ("space_id","source_local_id","variant");
CREATE UNIQUE INDEX "document_space_and_local_id_idx" ON "Document" USING btree ("space_id","source_local_id");
CREATE UNIQUE INDEX "document_url_idx" ON "Document" USING btree ("url");
CREATE UNIQUE INDEX "account_platform_and_id_idx" ON "PlatformAccount" USING btree ("account_local_id","platform");
CREATE INDEX "platform_account_dg_account_idx" ON "PlatformAccount" USING btree ("dg_account");
CREATE UNIQUE INDEX "space_url_idx" ON "Space" USING btree ("url");
CREATE UNIQUE INDEX "sync_info_u_idx" ON "sync_info" USING btree ("sync_target","sync_function");
CREATE VIEW "public"."my_accounts" AS (SELECT id, name, platform, account_local_id, write_permission, active, agent_type, metadata, dg_account FROM "PlatformAccount" pa WHERE (EXISTS ( SELECT 1 FROM "SpaceAccess" sa WHERE sa.account_id = pa.id AND (sa.space_id = ANY (my_space_ids())))));
CREATE VIEW "public"."my_concepts" AS (SELECT id, epistemic_status, name, description, author_id, created, last_modified, space_id, arity, schema_id, literal_content, reference_content, refs, is_schema, represented_by_id FROM "Concept" WHERE space_id = ANY (my_space_ids()));
CREATE VIEW "public"."my_contents" AS (SELECT id, document_id, source_local_id, variant, author_id, creator_id, created, text, metadata, scale, space_id, last_modified, part_of_id FROM "Content" WHERE space_id = ANY (my_space_ids()));
CREATE VIEW "public"."my_contents_with_embedding_openai_text_embedding_3_small_1536" AS (SELECT ct.id, ct.document_id, ct.source_local_id, ct.variant, ct.author_id, ct.creator_id, ct.created, ct.text, ct.metadata, ct.scale, ct.space_id, ct.last_modified, ct.part_of_id, emb.model, emb.vector FROM "Content" ct JOIN "ContentEmbedding_openai_text_embedding_3_small_1536" emb ON ct.id = emb.target_id WHERE (ct.space_id = ANY (my_space_ids())) AND NOT emb.obsolete);
CREATE VIEW "public"."my_documents" AS (SELECT id, space_id, source_local_id, url, created, metadata, last_modified, author_id, contents FROM "Document" WHERE space_id = ANY (my_space_ids()));
CREATE VIEW "public"."my_spaces" AS (SELECT id, url, name, platform FROM "Space" WHERE id = ANY (my_space_ids()));
CREATE POLICY "access_token_policy" ON "access_token" AS PERMISSIVE FOR ALL TO public USING (((platform_account_id IS NULL) OR is_my_account(platform_account_id)));
CREATE POLICY "agent_identifier_delete_policy" ON "AgentIdentifier" AS PERMISSIVE FOR DELETE TO public USING ((unowned_account_in_shared_space(account_id) OR (account_id = my_account())));
CREATE POLICY "agent_identifier_insert_policy" ON "AgentIdentifier" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((unowned_account_in_shared_space(account_id) OR (account_id = my_account())));
CREATE POLICY "agent_identifier_select_policy" ON "AgentIdentifier" AS PERMISSIVE FOR SELECT TO public USING (account_in_shared_space(account_id));
CREATE POLICY "agent_identifier_update_policy" ON "AgentIdentifier" AS PERMISSIVE FOR UPDATE TO public WITH CHECK ((unowned_account_in_shared_space(account_id) OR (account_id = my_account())));
CREATE POLICY "concept_policy" ON "Concept" AS PERMISSIVE FOR ALL TO public USING (in_space(space_id));
CREATE POLICY "concept_contributors_policy" ON "concept_contributors" AS PERMISSIVE FOR ALL TO public USING (concept_in_space(concept_id));
CREATE POLICY "content_policy" ON "Content" AS PERMISSIVE FOR ALL TO public USING (in_space(space_id));
CREATE POLICY "content_contributors_policy" ON "content_contributors" AS PERMISSIVE FOR ALL TO public USING (content_in_space(content_id));
CREATE POLICY "embedding_openai_te3s_1536_policy" ON "ContentEmbedding_openai_text_embedding_3_small_1536" AS PERMISSIVE FOR ALL TO public USING (content_in_space(target_id));
CREATE POLICY "document_policy" ON "Document" AS PERMISSIVE FOR ALL TO public USING (in_space(space_id));
CREATE POLICY "platform_account_delete_policy" ON "PlatformAccount" AS PERMISSIVE FOR DELETE TO public USING (((dg_account = ( SELECT auth.uid() AS uid LIMIT 1)) OR ((dg_account IS NULL) AND unowned_account_in_shared_space(id))));
CREATE POLICY "platform_account_insert_policy" ON "PlatformAccount" AS PERMISSIVE FOR INSERT TO public WITH CHECK (((dg_account = ( SELECT auth.uid() AS uid LIMIT 1)) OR ((dg_account IS NULL) AND unowned_account_in_shared_space(id))));
CREATE POLICY "platform_account_select_policy" ON "PlatformAccount" AS PERMISSIVE FOR SELECT TO public USING (((dg_account = ( SELECT auth.uid() AS uid LIMIT 1)) OR account_in_shared_space(id)));
CREATE POLICY "platform_account_update_policy" ON "PlatformAccount" AS PERMISSIVE FOR UPDATE TO public WITH CHECK (((dg_account = ( SELECT auth.uid() AS uid LIMIT 1)) OR ((dg_account IS NULL) AND unowned_account_in_shared_space(id))));
CREATE POLICY "space_insert_policy" ON "Space" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "space_policy" ON "Space" AS PERMISSIVE FOR ALL TO public USING (in_space(id));
CREATE POLICY "space_access_delete_policy" ON "SpaceAccess" AS PERMISSIVE FOR DELETE TO public USING ((unowned_account_in_shared_space(account_id) OR (account_id = my_account())));
CREATE POLICY "space_access_insert_policy" ON "SpaceAccess" AS PERMISSIVE FOR INSERT TO public WITH CHECK ((unowned_account_in_shared_space(account_id) OR (account_id = my_account())));
CREATE POLICY "space_access_select_policy" ON "SpaceAccess" AS PERMISSIVE FOR SELECT TO public USING (in_space(space_id));
CREATE POLICY "space_access_update_policy" ON "SpaceAccess" AS PERMISSIVE FOR UPDATE TO public WITH CHECK ((unowned_account_in_shared_space(account_id) OR (account_id = my_account())));
CREATE POLICY "sync_info_policy" ON "sync_info" AS PERMISSIVE FOR ALL TO public USING (generic_entity_access(sync_target, target_type));
