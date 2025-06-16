CREATE TYPE public."EpistemicStatus" AS ENUM (
    'certainly_not',
    'strong_evidence_against',
    'could_be_false',
    'unknown',
    'uncertain',
    'contentious',
    'could_be_true',
    'strong_evidence_for',
    'certain'
);

ALTER TYPE public."EpistemicStatus" OWNER TO postgres;

CREATE OR REPLACE FUNCTION extract_references(refs JSONB) RETURNS BIGINT [] LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_agg(i::bigint), '{}') FROM (SELECT DISTINCT jsonb_array_elements(jsonb_path_query_array(refs, '$.*[*]')) i) exrefs;
$$;

CREATE OR REPLACE FUNCTION compute_arity_lit(lit_content JSONB) RETURNS smallint language sql IMMUTABLE AS $$
  WITH q AS (SELECT jsonb_path_query(lit_content, '$.roles[*]')) SELECT count(*) FROM q;
$$;

SET check_function_bodies = false;
CREATE OR REPLACE FUNCTION compute_arity_id(p_schema_id BIGINT) RETURNS smallint language sql IMMUTABLE AS $$
  WITH q AS (SELECT jsonb_path_query(literal_content, '$.roles[*]') FROM public."Concept" WHERE id=p_schema_id) SELECT count(*) FROM q;
$$;
SET check_function_bodies = true;

CREATE OR REPLACE FUNCTION compute_arity_local(schema_id BIGINT, lit_content JSONB) RETURNS smallint language sql IMMUTABLE AS $$
  SELECT CASE WHEN schema_id IS NULL THEN compute_arity_lit(lit_content) ELSE compute_arity_id(schema_id) END;
$$;


CREATE TABLE IF NOT EXISTS public."Concept" (
    id bigint DEFAULT nextval(
        'public.entity_id_seq'::regclass
    ) NOT NULL,
    epistemic_status public."EpistemicStatus" DEFAULT 'unknown'::public."EpistemicStatus" NOT NULL,
    name character varying NOT NULL,
    description text,
    author_id bigint,
    created timestamp without time zone NOT NULL,
    last_modified timestamp without time zone NOT NULL,
    space_id bigint NOT NULL,
    arity smallint GENERATED ALWAYS AS (compute_arity_local(schema_id, literal_content)) STORED,
    schema_id bigint,
    literal_content jsonb NOT NULL DEFAULT '{}'::jsonb,
    reference_content jsonb NOT NULL DEFAULT '{}'::jsonb,
    refs BIGINT [] NOT NULL GENERATED ALWAYS AS (extract_references(reference_content)) STORED,
    is_schema boolean DEFAULT false NOT NULL,
    represented_by_id bigint
);

ALTER TABLE public."Concept" OWNER TO "postgres";

COMMENT ON TABLE public."Concept" IS 'An abstract concept, claim or relation';

COMMENT ON COLUMN public."Concept".author_id IS 'The author of content';

COMMENT ON COLUMN public."Concept".created IS 'The time when the content was created in the remote source';

COMMENT ON COLUMN public."Concept".last_modified IS 'The last time the content was modified in the remote source';

COMMENT ON COLUMN public."Concept".space_id IS 'The space in which the content is located';


ALTER TABLE ONLY public."Concept"
ADD CONSTRAINT "Concept_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY public."Concept"
ADD FOREIGN KEY (represented_by_id) REFERENCES public."Content" (
    id
) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX concept_literal_content_idx ON public."Concept" USING gin (
    literal_content jsonb_ops
);

CREATE INDEX concept_refs_idx ON public."Concept" USING gin (refs);

CREATE INDEX "Concept_schema" ON public."Concept" USING btree (schema_id);

CREATE INDEX "Concept_space" ON public."Concept" USING btree (space_id);

CREATE UNIQUE INDEX "Concept_represented_by" ON public."Concept" (
    represented_by_id
);

-- maybe make that for schemas only?
CREATE UNIQUE INDEX concept_space_and_name_idx ON public."Concept" (space_id, name);


ALTER TABLE ONLY public."Concept"
ADD CONSTRAINT "Concept_author_id_fkey" FOREIGN KEY (
    author_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Concept"
ADD CONSTRAINT "Concept_schema_id_fkey" FOREIGN KEY (
    schema_id
) REFERENCES public."Concept" (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Concept"
ADD CONSTRAINT "Concept_space_id_fkey" FOREIGN KEY (
    space_id
) REFERENCES public."Space" (
    id
) ON UPDATE CASCADE ON DELETE CASCADE;


GRANT ALL ON TABLE public."Concept" TO anon;
GRANT ALL ON TABLE public."Concept" TO authenticated;
GRANT ALL ON TABLE public."Concept" TO service_role;
