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
    represented_by_local_id VARCHAR,
    schema_represented_by_local_id VARCHAR,
    space_url VARCHAR,
    local_reference_content JSONB
);


CREATE OR REPLACE FUNCTION public.local_concept_to_db_concept(data public.concept_local_input) RETURNS public."Concept" LANGUAGE plpgsql STABLE AS $$
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
  IF data.represented_by_local_id IS NOT NULL THEN
    SELECT id FROM public."Content"
      WHERE source_local_id = data.represented_by_local_id INTO concept.represented_by_id;
  END IF;
  IF data.space_url IS NOT NULL THEN
    SELECT id FROM public."Space"
    WHERE url = data.space_url INTO concept.space_id;
  END IF;
  IF data.schema_represented_by_local_id IS NOT NULL THEN
    SELECT cpt.id FROM public."Concept" cpt
      JOIN public."Content" AS cnt ON cpt.represented_by_id = cnt.id
      WHERE cnt.source_local_id = data.schema_represented_by_local_id INTO concept.schema_id;
  END IF;
  IF data.local_reference_content IS NOT NULL THEN
    FOR key, value IN SELECT * FROM jsonb_each(data.local_reference_content) LOOP
      IF jsonb_typeof(value) = 'array' THEN
        WITH el AS (SELECT jsonb_array_elements_text(value) as x),
        ela AS (SELECT array_agg(x) AS a FROM el)
        SELECT array_agg(DISTINCT cpt.id) INTO STRICT ref_array_val
            FROM public."Concept" AS cpt
            JOIN public."Content" AS cnt ON (cpt.represented_by_id = cnt.id)
            JOIN ela ON (true) WHERE cnt.source_local_id = ANY(ela.a);
        reference_content := jsonb_set(reference_content, ARRAY[key], to_jsonb(ref_array_val));
      ELSIF jsonb_typeof(value) = 'string' THEN
        SELECT cpt.id INTO STRICT ref_single_val
            FROM public."Concept" AS cpt
            JOIN public."Content" AS cnt ON (cpt.represented_by_id = cnt.id)
            WHERE cnt.source_local_id = (value #>> '{}');
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
    db_concept := public.local_concept_to_db_concept(local_concept);
    BEGIN
        -- cannot use db_concept.* because of refs.
        INSERT INTO public."Concept" (
        epistemic_status, name, description, author_id, created, last_modified, space_id, schema_id, literal_content, is_schema, represented_by_id, reference_content
        ) VALUES (
        db_concept.epistemic_status, db_concept.name, db_concept.description, db_concept.author_id, db_concept.created, db_concept.last_modified, db_concept.space_id, db_concept.schema_id, db_concept.literal_content, db_concept.is_schema, db_concept.represented_by_id, db_concept.reference_content
        )
        ON CONFLICT (represented_by_id) DO UPDATE SET
            epistemic_status = db_concept.epistemic_status,
            name = db_concept.name,
            description = db_concept.description,
            author_id = db_concept.author_id,
            created = db_concept.created,
            last_modified = db_concept.last_modified,
            space_id = db_concept.space_id,
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
  RAISE DEBUG 'Completed upsert_content successfully';
END;
$$;
