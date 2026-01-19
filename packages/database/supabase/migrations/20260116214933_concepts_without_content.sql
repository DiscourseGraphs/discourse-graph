ALTER TABLE public."Concept" ADD COLUMN source_local_id character varying;

UPDATE public."Concept" AS cpt
SET source_local_id = (SELECT source_local_id FROM public."Content" AS cnt WHERE cnt.id = cpt.represented_by_id)
WHERE represented_by_id IS NOT NULL;

CREATE UNIQUE INDEX concept_space_local_id_idx ON public."Concept" USING btree (
    space_id, source_local_id
) NULLS DISTINCT;

COMMENT ON COLUMN public."Concept".source_local_id IS 'The unique identifier of the concept in the remote source';

ALTER TABLE public."Concept" DROP CONSTRAINT "Concept_represented_by_id_fkey";
DROP INDEX public."Concept_represented_by";
DROP INDEX "Concept_space";

-- explicitly dropping dependencies of my_concept
DROP FUNCTION schema_of_concept(my_concepts);
DROP FUNCTION instances_of_schema(my_concepts);
DROP FUNCTION concept_in_relations(my_concepts);
DROP FUNCTION concepts_of_relation(my_concepts);
DROP FUNCTION content_of_concept(my_concepts);
DROP FUNCTION author_of_concept(my_concepts);

DROP VIEW "public"."my_concepts";

CREATE VIEW "public"."my_concepts" AS
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
FROM "Concept"
WHERE (space_id = any(my_space_ids())) OR can_view_specific_concept(id);

ALTER TABLE public."Concept" DROP COLUMN represented_by_id;

ALTER TYPE public.concept_local_input ADD ATTRIBUTE source_local_id VARCHAR;


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

CREATE OR REPLACE FUNCTION public.author_of_concept(concept my_concepts)
RETURNS SETOF my_accounts
LANGUAGE sql
STABLE STRICT ROWS 1
SET search_path TO ''
AS $$
    SELECT * from public.my_accounts WHERE id=concept.author_id;
$$;

CREATE OR REPLACE FUNCTION public.concept_in_relations(concept my_concepts)
RETURNS SETOF my_concepts
LANGUAGE sql
STABLE STRICT
SET search_path TO ''
AS $$
    SELECT * from public.my_concepts WHERE refs @> ARRAY[concept.id];
$$;

CREATE OR REPLACE FUNCTION public.concepts_of_relation(relation my_concepts)
RETURNS SETOF my_concepts
LANGUAGE sql
STABLE STRICT
SET search_path TO ''
AS $$
    SELECT * from public.my_concepts WHERE id = any(relation.refs);
$$;

CREATE OR REPLACE FUNCTION public.instances_of_schema(schema my_concepts)
RETURNS SETOF my_concepts
LANGUAGE sql
STABLE STRICT
SET search_path TO ''
AS $$
    SELECT * from public.my_concepts WHERE schema_id=schema.id;
$$;

CREATE OR REPLACE FUNCTION public.schema_of_concept(concept my_concepts)
RETURNS SETOF my_concepts
LANGUAGE sql
STABLE STRICT ROWS 1
SET search_path TO ''
AS $$
    SELECT * from public.my_concepts WHERE id=concept.schema_id;
$$;

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
