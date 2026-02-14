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

CREATE OR REPLACE FUNCTION public.extract_references(refs JSONB)
RETURNS BIGINT [] IMMUTABLE
SET search_path = ''
LANGUAGE sql
AS $$
  SELECT COALESCE(array_agg(i::bigint), '{}') FROM (SELECT DISTINCT jsonb_array_elements(jsonb_path_query_array(refs, '$.*[*]')) i) exrefs;
$$;

SET check_function_bodies = false;
CREATE OR REPLACE FUNCTION public.compute_arity_local(schema_id BIGINT, lit_content JSONB)
RETURNS smallint IMMUTABLE
SET search_path = ''
LANGUAGE sql
AS $$
  SELECT CASE WHEN schema_id IS NULL THEN (
    SELECT COALESCE(jsonb_array_length(lit_content->'roles'), 0)
  ) ELSE (
    SELECT COALESCE(jsonb_array_length(literal_content->'roles'), 0) FROM public."Concept" WHERE id=compute_arity_local.schema_id
  ) END;
$$;
SET check_function_bodies = true;

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
    source_local_id character varying
);

ALTER TABLE public."Concept" OWNER TO "postgres";

COMMENT ON TABLE public."Concept" IS 'An abstract concept, claim or relation';

COMMENT ON COLUMN public."Concept".author_id IS 'The author of content';

COMMENT ON COLUMN public."Concept".created IS 'The time when the content was created in the remote source';

COMMENT ON COLUMN public."Concept".last_modified IS 'The last time the content was modified in the remote source';

COMMENT ON COLUMN public."Concept".space_id IS 'The space in which the content is located';

COMMENT ON COLUMN public."Concept".source_local_id IS 'The unique identifier of the concept in the remote source';

ALTER TABLE ONLY public."Concept"
ADD CONSTRAINT "Concept_pkey" PRIMARY KEY (id);

CREATE INDEX concept_literal_content_idx ON public."Concept" USING gin (
    literal_content jsonb_ops
);

CREATE INDEX concept_refs_idx ON public."Concept" USING gin (refs);

CREATE INDEX "Concept_schema" ON public."Concept" USING btree (schema_id);

CREATE UNIQUE INDEX concept_space_local_id_idx ON public."Concept" USING btree (
    space_id, source_local_id
) NULLS DISTINCT;

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


REVOKE ALL ON TABLE public."Concept" FROM anon;
GRANT ALL ON TABLE public."Concept" TO authenticated;
GRANT ALL ON TABLE public."Concept" TO service_role;

CREATE OR REPLACE VIEW public.my_concepts AS
WITH ra AS (
    SELECT DISTINCT space_id, source_local_id FROM public."ResourceAccess"
        JOIN public.my_user_accounts() ON (account_uid = my_user_accounts)
)

SELECT
    id,
    epistemic_status,
    name,
    description,
    author_id,
    created,
    last_modified,
    space_id,
    arity,
    schema_id,
    literal_content,
    reference_content,
    refs,
    is_schema,
    source_local_id
FROM public."Concept"
    LEFT OUTER JOIN ra USING (space_id, source_local_id)
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR (space_id = any(public.my_space_ids('partial')) AND ra.space_id IS NOT null)
);

-- following https://docs.postgrest.org/en/v13/references/api/resource_embedding.html#recursive-relationships
CREATE OR REPLACE FUNCTION public.schema_of_concept(concept public."Concept")
RETURNS SETOF public."Concept" STRICT STABLE
ROWS 1
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public."Concept" WHERE id=concept.schema_id;
$$;
COMMENT ON FUNCTION public.schema_of_concept(public."Concept")
IS 'Computed one-to-one: returns the schema Concept for a given Concept (by schema_id).';

CREATE OR REPLACE FUNCTION public.schema_of_concept(concept public.my_concepts)
RETURNS SETOF public.my_concepts STRICT STABLE
ROWS 1
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_concepts WHERE id=concept.schema_id;
$$;
COMMENT ON FUNCTION public.schema_of_concept(public.my_concepts)
IS 'Computed one-to-one: returns the schema Concept for a given Concept (by schema_id).';

CREATE OR REPLACE FUNCTION public.instances_of_schema(schema public."Concept")
RETURNS SETOF public."Concept" STRICT STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public."Concept" WHERE schema_id=schema.id;
$$;
COMMENT ON FUNCTION public.instances_of_schema(public."Concept")
IS 'Computed one-to-many: returns all Concept instances that are based on the given schema Concept.';

CREATE OR REPLACE FUNCTION public.instances_of_schema(schema public.my_concepts)
RETURNS SETOF public.my_concepts STRICT STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_concepts WHERE schema_id=schema.id;
$$;
COMMENT ON FUNCTION public.instances_of_schema(public.my_concepts)
IS 'Computed one-to-many: returns all Concept instances that are based on the given schema Concept.';

CREATE OR REPLACE FUNCTION public.concept_in_relations(concept public."Concept")
RETURNS SETOF public."Concept" STRICT STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public."Concept" WHERE refs @> ARRAY[concept.id];
$$;
COMMENT ON FUNCTION public.concept_in_relations(public."Concept")
IS 'Computed one-to-many: returns all Concept instances that are relations including the current concept.';

CREATE OR REPLACE FUNCTION public.concept_in_relations(concept public.my_concepts)
RETURNS SETOF public.my_concepts STRICT STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_concepts WHERE refs @> ARRAY[concept.id];
$$;
COMMENT ON FUNCTION public.concept_in_relations(public.my_concepts)
IS 'Computed one-to-many: returns all Concept instances that are relations including the current concept.';

CREATE OR REPLACE FUNCTION public.concepts_of_relation(relation public."Concept")
RETURNS SETOF public."Concept" STRICT STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public."Concept" WHERE id = any(relation.refs);
$$;
COMMENT ON FUNCTION public.concepts_of_relation(public."Concept")
IS 'Computed one-to-many: returns all Concept instances are referred to in the current concept.';

CREATE OR REPLACE FUNCTION public.concepts_of_relation(relation public.my_concepts)
RETURNS SETOF public.my_concepts STRICT STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_concepts WHERE id = any(relation.refs);
$$;
COMMENT ON FUNCTION public.concepts_of_relation(public.my_concepts)
IS 'Computed one-to-many: returns all Concept instances are referred to in the current concept.';

CREATE OR REPLACE FUNCTION public.content_of_concept(concept public.my_concepts)
RETURNS SETOF public.my_contents STRICT STABLE
ROWS 1
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_contents AS cnt
        WHERE cnt.space_id=concept.space_id
        AND cnt.source_local_id=concept.source_local_id;
$$;
COMMENT ON FUNCTION public.content_of_concept(public.my_concepts)
IS 'Computed one-to-one: returns the representing Content for a given Concept.';

CREATE OR REPLACE FUNCTION public.author_of_concept(concept public.my_concepts)
RETURNS SETOF public.my_accounts STRICT STABLE
ROWS 1
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_accounts WHERE id=concept.author_id;
$$;
COMMENT ON FUNCTION public.author_of_concept(public.my_concepts)
IS 'Computed one-to-one: returns the PlatformAccount which authored a given Concept.';


CREATE TYPE public.concept_local_input AS (
    -- concept columns
    epistemic_status public."EpistemicStatus",
    name character varying,
    description text,
    author_id bigint,
    created timestamp without time zone,
    last_modified timestamp without time zone,
    space_id bigint,
    schema_id bigint,
    literal_content jsonb,
    is_schema boolean,
    represented_by_id bigint,
    reference_content jsonb,
    -- local values
    author_local_id VARCHAR,
    represented_by_local_id VARCHAR, -- deprecated, use source_local_id
    schema_represented_by_local_id VARCHAR,
    space_url VARCHAR,
    local_reference_content JSONB,
    source_local_id VARCHAR
);

-- private function. Transform concept with local (platform) references to concept with db references
CREATE OR REPLACE FUNCTION public._local_concept_to_db_concept(data public.concept_local_input)
RETURNS public."Concept" STABLE
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  concept public."Concept"%ROWTYPE;
  reference_content JSONB := jsonb_build_object();
  key varchar;
  value JSONB;
  ref_single_val BIGINT;
  ref_array_val BIGINT[];
BEGIN
  -- not fan of going through json, but not finding how to populate a record by a different shape record
  concept := jsonb_populate_record(NULL::public."Concept", to_jsonb(data));
  IF data.author_local_id IS NOT NULL THEN
    SELECT id FROM public."PlatformAccount"
      WHERE account_local_id = data.author_local_id INTO concept.author_id;
  END IF;
  IF data.represented_by_id IS NOT NULL THEN
    SELECT space_id, source_local_id FROM public."Content"
      WHERE id = data.represented_by_id INTO concept.space_id, concept.source_local_id;
  END IF;
  IF data.space_url IS NOT NULL THEN
    SELECT id FROM public."Space"
    WHERE url = data.space_url INTO concept.space_id;
  END IF;
  IF data.schema_represented_by_local_id IS NOT NULL THEN
    SELECT cpt.id FROM public."Concept" cpt
      WHERE cpt.source_local_id = data.schema_represented_by_local_id
      AND cpt.space_id = concept.space_id INTO concept.schema_id;
  END IF;
  IF concept.source_local_id = '' THEN
    concept.source_local_id := NULL;
  END IF;
  IF data.represented_by_local_id = '' THEN
    data.represented_by_local_id := NULL;
  END IF;
  concept.source_local_id = COALESCE(concept.source_local_id, data.represented_by_local_id); -- legacy input field
  IF data.local_reference_content IS NOT NULL THEN
    FOR key, value IN SELECT * FROM jsonb_each(data.local_reference_content) LOOP
      IF jsonb_typeof(value) = 'array' THEN
        WITH el AS (SELECT jsonb_array_elements_text(value) as x),
        ela AS (SELECT array_agg(x) AS a FROM el)
        SELECT array_agg(DISTINCT cpt.id) INTO STRICT ref_array_val
            FROM public."Concept" AS cpt
            JOIN ela ON (true) WHERE cpt.source_local_id = ANY(ela.a) AND cpt.space_id=concept.space_id;
        reference_content := jsonb_set(reference_content, ARRAY[key], to_jsonb(ref_array_val));
      ELSIF jsonb_typeof(value) = 'string' THEN
        SELECT cpt.id INTO STRICT ref_single_val
            FROM public."Concept" AS cpt
            WHERE cpt.source_local_id = (value #>> '{}') AND cpt.space_id=concept.space_id;
        reference_content := jsonb_set(reference_content, ARRAY[key], to_jsonb(ref_single_val));
      ELSE
        RAISE EXCEPTION 'Invalid value in local_reference_content % %', value, jsonb_typeof(value);
      END IF;
    END LOOP;
    SELECT reference_content INTO concept.reference_content;
  END IF;
  RETURN concept;
END;
$$;

-- The data should be an array of LocalConceptDataInput
-- Concepts are upserted, based on source_local_id. New (or old) IDs are returned.
-- name conflicts will cause an insertion failure, and the ID will be given as -1
CREATE OR REPLACE FUNCTION public.upsert_concepts(v_space_id bigint, data jsonb)
RETURNS SETOF BIGINT
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  v_platform public."Platform";
  local_concept public.concept_local_input;
  db_concept public."Concept"%ROWTYPE;
  concept_row JSONB;
  concept_id BIGINT;
BEGIN
  SELECT platform INTO STRICT v_platform FROM public."Space" WHERE id=v_space_id;
  FOR concept_row IN SELECT * FROM jsonb_array_elements(data)
  LOOP
    -- first set defaults
    local_concept := jsonb_populate_record(NULL::public.concept_local_input, '{"epistemic_status": "unknown", "literal_content":{},"reference_content":{},"is_schema":false}');
    -- then input values
    local_concept := jsonb_populate_record(local_concept, concept_row);
    local_concept.space_id := v_space_id;
    db_concept := public._local_concept_to_db_concept(local_concept);
    BEGIN
        -- cannot use db_concept.* because of refs.
        INSERT INTO public."Concept" (
        epistemic_status, name, description, author_id, created, last_modified, space_id, schema_id, literal_content, is_schema, source_local_id, reference_content
        ) VALUES (
        db_concept.epistemic_status, db_concept.name, db_concept.description, db_concept.author_id, db_concept.created, db_concept.last_modified, db_concept.space_id, db_concept.schema_id, db_concept.literal_content, db_concept.is_schema, db_concept.source_local_id, db_concept.reference_content
        )
        ON CONFLICT (space_id, source_local_id) DO UPDATE SET
            epistemic_status = db_concept.epistemic_status,
            name = db_concept.name,
            description = db_concept.description,
            author_id = db_concept.author_id,
            created = db_concept.created,
            last_modified = db_concept.last_modified,
            schema_id = db_concept.schema_id,
            literal_content = db_concept.literal_content,
            is_schema = db_concept.is_schema,
            reference_content = db_concept.reference_content
        -- ON CONFLICT (space_id, name) DO NOTHING... why can't I specify two conflict clauses?
        RETURNING id INTO concept_id;
        RETURN NEXT concept_id;
    EXCEPTION
        WHEN unique_violation THEN
            -- a distinct unique constraint failed
            RAISE WARNING 'Concept with space_id: % and name % already exists', v_space_id, local_concept.name;
            RETURN NEXT -1; -- Return a special value to indicate conflict
    END;
  END LOOP;
  RAISE DEBUG 'Completed upsert_concepts successfully';
END;
$$;

CREATE OR REPLACE FUNCTION public.concept_in_space(concept_id BIGINT, access_level public."SpaceAccessPermissions" = 'reader') RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.in_space(space_id, access_level) FROM public."Concept" WHERE id=concept_id
$$;

COMMENT ON FUNCTION public.concept_in_space IS 'security utility: does current user have access to this concept''s space?';

ALTER TABLE public."Concept" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS concept_policy ON public."Concept";
DROP POLICY IF EXISTS concept_select_policy ON public."Concept";
CREATE POLICY concept_select_policy ON public."Concept" FOR SELECT USING (public.in_space(space_id) OR public.can_view_specific_resource(space_id, source_local_id));
DROP POLICY IF EXISTS concept_delete_policy ON public."Concept";
CREATE POLICY concept_delete_policy ON public."Concept" FOR DELETE USING (public.in_space(space_id));
DROP POLICY IF EXISTS concept_insert_policy ON public."Concept";
CREATE POLICY concept_insert_policy ON public."Concept" FOR INSERT WITH CHECK (public.in_space(space_id));
DROP POLICY IF EXISTS concept_update_policy ON public."Concept";
CREATE POLICY concept_update_policy ON public."Concept" FOR UPDATE USING (public.in_space(space_id));

-- since ResourceAccess is used for both Content and Concepts,
-- we cannot count on the usual foreign key delete cascades.
-- Implementing with triggers

CREATE OR REPLACE FUNCTION public.is_last_local_reference(space_id_ BIGINT, source_local_id_ VARCHAR) RETURNS boolean
STABLE
SET search_path = ''
SECURITY DEFINER
LANGUAGE sql
AS $$
    SELECT NOT EXISTS (SELECT id FROM public."Content" WHERE space_id=space_id_ AND source_local_id=source_local_id_ LIMIT 1)
       AND NOT EXISTS (SELECT id FROM public."Concept" WHERE space_id=space_id_ AND source_local_id=source_local_id_ LIMIT 1)
       AND NOT EXISTS (SELECT id FROM public."Document" WHERE space_id=space_id_ AND source_local_id=source_local_id_ LIMIT 1);
$$;

CREATE OR REPLACE FUNCTION on_delete_local_reference() RETURNS TRIGGER
SET search_path = ''
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    IF public.is_last_local_reference(OLD.space_id, OLD.source_local_id) THEN
    DELETE FROM public."ResourceAccess" WHERE space_id=OLD.space_id AND source_local_id=OLD.source_local_id;
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER on_delete_content_trigger AFTER DELETE ON public."Content" FOR EACH ROW EXECUTE FUNCTION public.on_delete_local_reference();
CREATE TRIGGER on_delete_concept_trigger AFTER DELETE ON public."Concept" FOR EACH ROW EXECUTE FUNCTION public.on_delete_local_reference();
CREATE TRIGGER on_delete_document_trigger AFTER DELETE ON public."Document" FOR EACH ROW EXECUTE FUNCTION public.on_delete_local_reference();

CREATE OR REPLACE FUNCTION on_update_local_reference() RETURNS TRIGGER
SET search_path = ''
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (OLD.space_id IS DISTINCT FROM NEW.space_id OR
        OLD.source_local_id IS DISTINCT FROM NEW.source_local_id)
    AND public.is_last_local_reference(OLD.space_id, OLD.source_local_id) THEN
        DELETE FROM public."ResourceAccess" WHERE space_id=OLD.space_id AND source_local_id=OLD.source_local_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_update_content_trigger AFTER UPDATE ON public."Content" FOR EACH ROW EXECUTE FUNCTION public.on_update_local_reference();
CREATE TRIGGER on_update_concept_trigger AFTER UPDATE ON public."Concept" FOR EACH ROW EXECUTE FUNCTION public.on_update_local_reference();
CREATE TRIGGER on_update_document_trigger AFTER UPDATE ON public."Document" FOR EACH ROW EXECUTE FUNCTION public.on_update_local_reference();

CREATE OR REPLACE FUNCTION public.on_delete_space_revoke_local_access() RETURNS TRIGGER
SET search_path = ''
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM public."ResourceAccess" WHERE space_id=OLD.id;
    RETURN OLD;
END;
$$;

CREATE TRIGGER on_delete_space_revoke_access_trigger AFTER DELETE ON public."Space" FOR EACH ROW EXECUTE FUNCTION public.on_delete_space_revoke_local_access();
