
CREATE SEQUENCE IF NOT EXISTS public.entity_id_seq
    AS BIGINT
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


CREATE TYPE "EntityType" AS ENUM ('Platform', 'Space', 'Account', 'Person', 'AutomatedAgent', 'Document', 'Content', 'Concept', 'ConceptSchema', 'ContentLink', 'Occurrence');

CREATE TYPE "Scale" AS ENUM ('document', 'post', 'chunk_unit', 'section', 'block', 'field', 'paragraph', 'quote', 'sentence', 'phrase');

CREATE TYPE "EmbeddingName" AS ENUM ('openai_text_embedding_ada2_1536', 'openai_text_embedding_3_small_512', 'openai_text_embedding_3_small_1536', 'openai_text_embedding_3_large_256', 'openai_text_embedding_3_large_1024', 'openai_text_embedding_3_large_3072');

CREATE TYPE "EpistemicStatus" AS ENUM ('certainly_not', 'strong_evidence_against', 'could_be_false', 'unknown', 'uncertain', 'contentious', 'could_be_true', 'strong_evidence_for', 'certain');

CREATE TABLE "Agent" (
	id BIGINT NOT NULL PRIMARY KEY DEFAULT nextval('public.entity_id_seq'::regclass),
	type "EntityType" NOT NULL
);
COMMENT ON TABLE "Agent" IS 'An agent that acts in the system';


CREATE TABLE "Person" (
	id BIGINT NOT NULL PRIMARY KEY,
	name VARCHAR NOT NULL,
	orcid VARCHAR(20),
	email VARCHAR NOT NULL,
	CONSTRAINT person_id_fkey  FOREIGN KEY (id)
      REFERENCES "Agent" (id) ON DELETE CASCADE ON UPDATE CASCADE
);
COMMENT ON TABLE "Person" IS 'A person using the system';


CREATE TABLE "AutomatedAgent" (
    id BIGINT NOT NULL PRIMARY KEY,
    name VARCHAR NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
	deterministic BOOLEAN DEFAULT FALSE,
	version VARCHAR,
	CONSTRAINT person_id_fkey  FOREIGN KEY (id)
      REFERENCES "Agent" (id) ON DELETE CASCADE ON UPDATE CASCADE
);
COMMENT ON TABLE "AutomatedAgent" IS 'An automated agent';


CREATE TABLE "DiscoursePlatform" (
	id BIGINT NOT NULL PRIMARY KEY DEFAULT nextval('public.entity_id_seq'::regclass),
	name VARCHAR NOT NULL,
	url VARCHAR NOT NULL
);
COMMENT ON TABLE "DiscoursePlatform" IS 'A data platform where discourse happens';


CREATE TABLE "Account" (
	id BIGINT NOT NULL PRIMARY KEY DEFAULT nextval('public.entity_id_seq'::regclass),
	platform_id BIGINT NOT NULL,
	person_id BIGINT NOT NULL,
	write_permission BOOLEAN NOT NULL,
	active BOOLEAN NOT NULL DEFAULT TRUE,
	FOREIGN KEY(platform_id) REFERENCES "DiscoursePlatform" (id) ON DELETE CASCADE ON UPDATE CASCADE,
	FOREIGN KEY(person_id) REFERENCES "Agent" (id) ON DELETE CASCADE ON UPDATE CASCADE
);
COMMENT ON TABLE "Account" IS 'A user account on a discourse platform';


CREATE TABLE "DiscourseSpace" (
	id BIGINT NOT NULL PRIMARY KEY DEFAULT nextval('public.entity_id_seq'::regclass),
	url VARCHAR,
	name VARCHAR NOT NULL,
	discourse_platform_id BIGINT NOT NULL,
	FOREIGN KEY(discourse_platform_id) REFERENCES "DiscoursePlatform" (id) ON DELETE CASCADE ON UPDATE CASCADE
);
COMMENT ON TABLE "DiscourseSpace" IS 'A space on a discourse platform representing a community engaged in a conversation';


CREATE TABLE "SpaceAccess" (
	id BIGINT NOT NULL PRIMARY KEY DEFAULT nextval('public.entity_id_seq'::regclass),
	space_id BIGINT,
	account_id BIGINT NOT NULL,
	editor BOOLEAN NOT NULL,
	UNIQUE (account_id, space_id),
	FOREIGN KEY(space_id) REFERENCES "DiscourseSpace" (id) ON DELETE CASCADE ON UPDATE CASCADE,
	FOREIGN KEY(account_id) REFERENCES "Account" (id) ON DELETE CASCADE ON UPDATE CASCADE
);
COMMENT ON TABLE "SpaceAccess" IS 'An access control entry for a space';
COMMENT ON COLUMN "SpaceAccess".space_id IS 'The space in which the content is located';


CREATE TABLE "Document" (
	id BIGINT NOT NULL PRIMARY KEY DEFAULT nextval('public.entity_id_seq'::regclass),
	space_id BIGINT,
	source_local_id VARCHAR,
	url VARCHAR,
	last_synced TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	created TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	metadata JSONB NOT NULL DEFAULT '{}',
	last_modified TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	author_id BIGINT NOT NULL,
	contents OID,
	FOREIGN KEY(space_id) REFERENCES "DiscourseSpace" (id) ON DELETE CASCADE ON UPDATE CASCADE,
	FOREIGN KEY(author_id) REFERENCES "Agent" (id) ON DELETE CASCADE ON UPDATE CASCADE
);
COMMENT ON COLUMN "Document".space_id IS 'The space in which the content is located';
COMMENT ON COLUMN "Document".source_local_id IS 'The unique identifier of the content in the remote source';
COMMENT ON COLUMN "Document".last_synced IS 'The last time the content was synced with the remote source';
COMMENT ON COLUMN "Document".created IS 'The time when the content was created in the remote source';
COMMENT ON COLUMN "Document".last_modified IS 'The last time the content was modified in the remote source';
COMMENT ON COLUMN "Document".author_id IS 'The author of content';
COMMENT ON COLUMN "Document".contents IS 'A large object OID for the downloaded raw content';

CREATE TABLE "Concept" (
	id BIGINT NOT NULL PRIMARY KEY DEFAULT nextval('public.entity_id_seq'::regclass),
	epistemic_status "EpistemicStatus" NOT NULL DEFAULT 'unknown',
	name VARCHAR NOT NULL,
	description TEXT,
	author_id BIGINT,
	created TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	last_modified TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	last_synced TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	space_id BIGINT,
	arity SMALLINT NOT NULL DEFAULT 0,
	schema_id BIGINT,
	content JSONB NOT NULL DEFAULT '{}',
	is_schema BOOLEAN NOT NULL DEFAULT FALSE,
	FOREIGN KEY(author_id) REFERENCES "Agent" (id) ON DELETE SET NULL ON UPDATE CASCADE,
	FOREIGN KEY(space_id) REFERENCES "DiscourseSpace" (id) ON DELETE CASCADE ON UPDATE CASCADE,
	FOREIGN KEY(schema_id) REFERENCES "Concept" (id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Concept_space" ON "Concept" (space_id);
CREATE INDEX "Concept_schema" ON "Concept" (schema_id);
CREATE INDEX "Concept_content" ON "Concept" USING GIN (content jsonb_path_ops);


COMMENT ON TABLE "Concept" IS 'An abstract concept, claim or relation';
COMMENT ON COLUMN "Concept".author_id IS 'The author of content';
COMMENT ON COLUMN "Concept".created IS 'The time when the content was created in the remote source';
COMMENT ON COLUMN "Concept".last_modified IS 'The last time the content was modified in the remote source';
COMMENT ON COLUMN "Concept".last_synced IS 'The last time the content was synced with the remote source';
COMMENT ON COLUMN "Concept".space_id IS 'The space in which the content is located';


CREATE TABLE "Content" (
	id BIGINT NOT NULL PRIMARY KEY DEFAULT nextval('public.entity_id_seq'::regclass),
	document_id BIGINT NOT NULL,
	source_local_id VARCHAR,
	author_id BIGINT,
	creator_id BIGINT,
	created TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	text TEXT NOT NULL,
	metadata JSONB NOT NULL DEFAULT '{}',
	scale "Scale" NOT NULL,
	space_id BIGINT,
	last_modified TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	last_synced TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	part_of_id BIGINT,
	represents_id BIGINT,
	FOREIGN KEY(document_id) REFERENCES "Document" (id) ON DELETE CASCADE ON UPDATE CASCADE,
	FOREIGN KEY(author_id) REFERENCES "Agent" (id) ON DELETE SET NULL ON UPDATE CASCADE,
	FOREIGN KEY(creator_id) REFERENCES "Agent" (id) ON DELETE SET NULL ON UPDATE CASCADE,
	FOREIGN KEY(space_id) REFERENCES "DiscourseSpace" (id) ON DELETE CASCADE ON UPDATE CASCADE,
	FOREIGN KEY(part_of_id) REFERENCES "Content" (id) ON DELETE SET NULL ON UPDATE CASCADE,
	FOREIGN KEY(represents_id) REFERENCES "Concept" (id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Content_text" ON "Content" USING pgroonga (text);
CREATE INDEX "Content_space" ON "Content" (space_id);
CREATE INDEX "Content_document" ON "Content" (document_id);
CREATE INDEX "Content_part_of" ON "Content" (part_of_id);
CREATE INDEX "Content_represents" ON "Content" (represents_id);

COMMENT ON TABLE "Content" IS 'A unit of content';
COMMENT ON COLUMN "Content".source_local_id IS 'The unique identifier of the content in the remote source';
COMMENT ON COLUMN "Content".author_id IS 'The author of content';
COMMENT ON COLUMN "Content".creator_id IS 'The creator of a logical structure, such as a content subdivision';
COMMENT ON COLUMN "Content".created IS 'The time when the content was created in the remote source';
COMMENT ON COLUMN "Content".space_id IS 'The space in which the content is located';
COMMENT ON COLUMN "Content".last_modified IS 'The last time the content was modified in the remote source';
COMMENT ON COLUMN "Content".last_synced IS 'The last time the content was synced with the remote source';
COMMENT ON COLUMN "Content".part_of_id IS 'This content is part of a larger content unit';
COMMENT ON COLUMN "Content".represents_id IS 'This content explicitly represents a concept';


CREATE TABLE concept_contributors (
	concept_id BIGINT,
	contributor_id BIGINT,
	PRIMARY KEY (concept_id, contributor_id),
	FOREIGN KEY(concept_id) REFERENCES "Concept" (id) ON DELETE CASCADE ON UPDATE CASCADE,
	FOREIGN KEY(contributor_id) REFERENCES "Agent" (id) ON DELETE CASCADE ON UPDATE CASCADE
);


CREATE TABLE "ContentEmbedding_openai_text_embedding_3_small_1536" (
	target_id BIGINT NOT NULL,
	model "EmbeddingName" NOT NULL DEFAULT 'openai_text_embedding_3_small_1536',
	vector extensions.vector(1536) NOT NULL,
	obsolete BOOLEAN DEFAULT FALSE,
	PRIMARY KEY (target_id),
	FOREIGN KEY(target_id) REFERENCES "Content" (id) ON DELETE CASCADE ON UPDATE CASCADE
);


CREATE TABLE content_contributors (
	content_id BIGINT,
	contributor_id BIGINT,
	PRIMARY KEY (content_id, contributor_id),
	FOREIGN KEY(content_id) REFERENCES "Content" (id) ON DELETE CASCADE ON UPDATE CASCADE,
	FOREIGN KEY(contributor_id) REFERENCES "Agent" (id) ON DELETE CASCADE ON UPDATE CASCADE
);
