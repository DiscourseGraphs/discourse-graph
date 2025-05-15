CREATE TYPE "public"."Scale" AS ENUM (
    'document',
    'post',
    'chunk_unit',
    'section',
    'block',
    'field',
    'paragraph',
    'quote',
    'sentence',
    'phrase'
);

ALTER TYPE "public"."Scale" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."Document" (
    "id" bigint DEFAULT "nextval"('"public"."entity_id_seq"'::"regclass") NOT NULL,
    "space_id" bigint,
    "source_local_id" character varying,
    "url" character varying,
    "created" timestamp without time zone NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_modified" timestamp without time zone NOT NULL,
    "author_id" bigint NOT NULL,
    "contents" "oid"
);

ALTER TABLE ONLY "public"."Document"
    ADD CONSTRAINT "Document_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."Document"
    ADD CONSTRAINT "Document_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."Agent"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."Document"
    ADD CONSTRAINT "Document_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."DiscourseSpace"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."Document" OWNER TO "postgres";

COMMENT ON COLUMN "public"."Document"."space_id" IS 'The space in which the content is located';

COMMENT ON COLUMN "public"."Document"."source_local_id" IS 'The unique identifier of the content in the remote source';

COMMENT ON COLUMN "public"."Document"."created" IS 'The time when the content was created in the remote source';

COMMENT ON COLUMN "public"."Document"."last_modified" IS 'The last time the content was modified in the remote source';

COMMENT ON COLUMN "public"."Document"."author_id" IS 'The author of content';

COMMENT ON COLUMN "public"."Document"."contents" IS 'A large object OID for the downloaded raw content';


CREATE TABLE IF NOT EXISTS "public"."Content" (
    "id" bigint DEFAULT "nextval"('"public"."entity_id_seq"'::"regclass") NOT NULL,
    "document_id" bigint NOT NULL,
    "source_local_id" character varying,
    "author_id" bigint,
    "creator_id" bigint,
    "created" timestamp without time zone NOT NULL,
    "text" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "scale" "public"."Scale" NOT NULL,
    "space_id" bigint,
    "last_modified" timestamp without time zone NOT NULL,
    "part_of_id" bigint
);

ALTER TABLE ONLY "public"."Content"
    ADD CONSTRAINT "Content_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."Content"
    ADD CONSTRAINT "Content_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."Agent"("id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY "public"."Content"
    ADD CONSTRAINT "Content_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."Agent"("id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY "public"."Content"
    ADD CONSTRAINT "Content_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."Document"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."Content"
    ADD CONSTRAINT "Content_part_of_id_fkey" FOREIGN KEY ("part_of_id") REFERENCES "public"."Content"("id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY "public"."Content"
    ADD CONSTRAINT "Content_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."DiscourseSpace"("id") ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX "Content_document" ON "public"."Content" USING "btree" ("document_id");

CREATE INDEX "Content_part_of" ON "public"."Content" USING "btree" ("part_of_id");

CREATE INDEX "Content_space" ON "public"."Content" USING "btree" ("space_id");

CREATE UNIQUE INDEX "Content_space_and_id" ON "public"."Content" USING "btree" ("space_id", "source_local_id") WHERE ("source_local_id" IS NOT NULL);

CREATE INDEX "Content_text" ON "public"."Content" USING "pgroonga" ("text");

ALTER TABLE "public"."Content" OWNER TO "postgres";

COMMENT ON TABLE "public"."Content" IS 'A unit of content';

COMMENT ON COLUMN "public"."Content"."source_local_id" IS 'The unique identifier of the content in the remote source';

COMMENT ON COLUMN "public"."Content"."author_id" IS 'The author of content';

COMMENT ON COLUMN "public"."Content"."creator_id" IS 'The creator of a logical structure, such as a content subdivision';

COMMENT ON COLUMN "public"."Content"."created" IS 'The time when the content was created in the remote source';

COMMENT ON COLUMN "public"."Content"."space_id" IS 'The space in which the content is located';

COMMENT ON COLUMN "public"."Content"."last_modified" IS 'The last time the content was modified in the remote source';

COMMENT ON COLUMN "public"."Content"."part_of_id" IS 'This content is part of a larger content unit';


GRANT ALL ON TABLE "public"."Document" TO "anon";
GRANT ALL ON TABLE "public"."Document" TO "authenticated";
GRANT ALL ON TABLE "public"."Document" TO "service_role";

GRANT ALL ON TABLE "public"."Content" TO "anon";
GRANT ALL ON TABLE "public"."Content" TO "authenticated";
GRANT ALL ON TABLE "public"."Content" TO "service_role";
