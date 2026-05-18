import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = join(process.cwd(), "..", "..");

const readRepoFile = (path: string): string =>
  readFileSync(join(repoRoot, path), "utf8");

const compactSql = (sql: string): string =>
  sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();

const contentSchema = compactSql(
  readRepoFile("packages/database/supabase/schemas/content.sql"),
);
const assetsSchema = compactSql(
  readRepoFile("packages/database/supabase/schemas/assets.sql"),
);
const embeddingSchema = compactSql(
  readRepoFile("packages/database/supabase/schemas/embedding.sql"),
);
const migration = compactSql(
  readRepoFile(
    "packages/database/supabase/migrations/20260517172000_atjson_content_type.sql",
  ),
);
const schemaYaml = readRepoFile("packages/database/schema.yaml");
const dbTypes = readRepoFile("packages/database/src/dbTypes.ts");

void test("Content SQL models content_type as the representation discriminator", () => {
  assert.match(
    contentSchema,
    /content_type text NOT NULL DEFAULT 'text\/plain'/,
  );
  assert.match(
    contentSchema,
    /CREATE UNIQUE INDEX content_space_local_id_variant_idx ON public\."Content" USING btree \( space_id, source_local_id, variant, content_type \)/,
  );
  assert.match(
    contentSchema,
    /CREATE TYPE public\.content_local_input AS \(.*variant public\."ContentVariant", content_type text \)/,
  );
  assert.match(contentSchema, /content_type FROM public\."Content"/);
  assert.match(
    contentSchema,
    /WHEN content\.variant = 'full'::public\."ContentVariant" THEN 'text\/markdown' ELSE 'text\/plain'/,
  );
  assert.match(
    contentSchema,
    /ON CONFLICT \(space_id, source_local_id, variant, content_type\) DO UPDATE SET/,
  );
});

void test("ATJSON migration backfills and preserves multiple representations", () => {
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'text\/plain'/,
  );
  assert.match(
    migration,
    /UPDATE public\."Content" SET content_type = 'text\/markdown' WHERE variant = 'full'::public\."ContentVariant" AND content_type = 'text\/plain'/,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX content_space_local_id_variant_idx ON public\."Content" USING btree \( space_id, source_local_id, variant, content_type \)/,
  );
  assert.match(
    migration,
    /ON CONFLICT \(space_id, source_local_id, variant, content_type\) DO UPDATE SET/,
  );
  assert.match(
    migration,
    /ALTER TYPE public\.content_local_input ADD ATTRIBUTE content_type text/,
  );
  assert.match(
    migration,
    /DO \$\$ BEGIN IF NOT EXISTS .* THEN ALTER TYPE public\.content_local_input ADD ATTRIBUTE content_type text; END IF; END; \$\$;/,
  );
  assert.match(
    migration,
    /CREATE OR REPLACE VIEW public\.my_contents AS SELECT.*content_type FROM public\."Content"/,
  );
  assert.match(
    migration,
    /CREATE OR REPLACE VIEW public\.my_contents_with_embedding_openai_text_embedding_3_small_1536 AS SELECT.*ct\.content_type/,
  );
});

void test("content parent lookup stays deterministic with multiple representations", () => {
  const parentLookupPattern =
    /SELECT parent_content\.id INTO content\.part_of_id FROM public\."Content" AS parent_content WHERE parent_content\.source_local_id = data\.part_of_local_id AND \(content\.space_id IS NULL OR parent_content\.space_id = content\.space_id\) ORDER BY CASE WHEN parent_content\.variant = 'direct'::public\."ContentVariant" AND parent_content\.content_type = 'text\/plain' THEN 0 WHEN parent_content\.content_type = 'text\/plain' THEN 1 WHEN parent_content\.content_type = 'text\/markdown' THEN 2 ELSE 3 END, parent_content\.id LIMIT 1/;
  assert.match(contentSchema, parentLookupPattern);
  assert.match(migration, parentLookupPattern);
});

void test("FileReference still targets Markdown full content rows", () => {
  assert.match(
    assetsSchema,
    /variant public\."ContentVariant" GENERATED ALWAYS AS \('full'\) STORED, content_type text GENERATED ALWAYS AS \('text\/markdown'\) STORED/,
  );
  assert.match(
    assetsSchema,
    /FOREIGN KEY \( space_id, source_local_id, variant, content_type \) REFERENCES public\."Content" \(space_id, source_local_id, variant, content_type\)/,
  );
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS content_type text GENERATED ALWAYS AS \('text\/markdown'\) STORED/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \( space_id, source_local_id, variant, content_type \) REFERENCES public\."Content" \(space_id, source_local_id, variant, content_type\)/,
  );
});

void test("embedding view and generated types expose content_type", () => {
  assert.match(
    embeddingSchema,
    /CREATE OR REPLACE VIEW public\.my_contents_with_embedding_openai_text_embedding_3_small_1536 AS SELECT.*ct\.content_type/,
  );
  assert.match(dbTypes, /content_type: string/);
  assert.match(dbTypes, /content_type\?: string/);
  assert.match(dbTypes, /content_type: string \| null/);
});

void test("upsert_content only accepts inline embeddings for plain text rows", () => {
  const embeddingGuardPattern =
    /IF model\(embedding_inline\(local_content\)\) IS NOT NULL AND db_content\.content_type = 'text\/plain' THEN PERFORM public\.upsert_content_embedding/;
  assert.match(contentSchema, embeddingGuardPattern);
  assert.match(migration, embeddingGuardPattern);
});

void test("LinkML schema keeps variant semantic and content_type representational", () => {
  assert.match(schemaYaml, /full:/);
  assert.match(schemaYaml, /content_type:/);
  assert.match(
    schemaYaml,
    /unique_keys:[\s\S]*content_space_and_local_id:[\s\S]*unique_key_slots:[\s\S]*- space[\s\S]*- source_local_id[\s\S]*- variant[\s\S]*- content_type/,
  );
});
