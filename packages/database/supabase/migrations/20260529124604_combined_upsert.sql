ALTER TYPE public.concept_local_input ADD ATTRIBUTE creator_local_id VARCHAR;
ALTER TYPE public.concept_local_input ADD ATTRIBUTE document_local_id VARCHAR;
ALTER TYPE public.concept_local_input ADD ATTRIBUTE contents_inline public.content_local_input [];
ALTER TYPE public.concept_local_input ADD ATTRIBUTE document_inline public.document_local_input;
ALTER TYPE public.concept_local_input ADD ATTRIBUTE author_inline public.account_local_input;
ALTER TYPE public.concept_local_input ADD ATTRIBUTE creator_inline public.account_local_input;

DROP FUNCTION public.upsert_concepts;

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
  ELSIF account_local_id(author_inline(data)) IS NOT NULL THEN
    SELECT id FROM public."PlatformAccount"
        WHERE account_local_id = account_local_id(author_inline(data)) INTO concept.author_id;
  END IF;
  IF data.represented_by_id IS NOT NULL THEN
    SELECT space_id, source_local_id FROM public."Content"
      WHERE id = data.represented_by_id INTO concept.space_id, concept.source_local_id;
  END IF;
  IF data.space_url IS NOT NULL THEN
    SELECT id FROM public."Space"
    WHERE url = data.space_url INTO concept.space_id;
  END IF;
  IF concept.source_local_id = '' THEN
    concept.source_local_id := NULL;
  END IF;
  IF data.represented_by_local_id = '' THEN
    data.represented_by_local_id := NULL;
  END IF;
  IF data.schema_represented_by_local_id IS NOT NULL THEN
    SELECT public.rid_or_local_id_to_concept_db_id(
        data.schema_represented_by_local_id, concept.space_id) INTO concept.schema_id;
  END IF;
  concept.source_local_id = COALESCE(concept.source_local_id, data.represented_by_local_id); -- legacy input field
  concept.reference_content := coalesce(data.reference_content, '{}'::jsonb);
  IF data.local_reference_content IS NOT NULL THEN
    FOR key, value IN SELECT * FROM jsonb_each(data.local_reference_content) LOOP
      IF jsonb_typeof(value) = 'array' THEN
        WITH el AS (SELECT jsonb_array_elements_text(value) as x),
        el2 AS (SELECT public.rid_or_local_id_to_concept_db_id(x, concept.space_id) AS id FROM el)
        SELECT array_agg(DISTINCT el2.id) INTO STRICT ref_array_val
            FROM el2 WHERE el2.id IS NOT NULL;
        reference_content := jsonb_set(reference_content, ARRAY[key], to_jsonb(ref_array_val));
      ELSIF jsonb_typeof(value) = 'string' THEN
        SELECT public.rid_or_local_id_to_concept_db_id(value #>> '{}', concept.space_id) INTO STRICT ref_single_val;
        reference_content := jsonb_set(reference_content, ARRAY[key], to_jsonb(ref_single_val));
      ELSE
        RAISE EXCEPTION 'Invalid value in local_reference_content % %', value, jsonb_typeof(value);
      END IF;
    END LOOP;
    concept.reference_content := concept.reference_content || reference_content;
  END IF;
  RETURN concept;
END;
$$;

CREATE FUNCTION public.upsert_concepts(v_space_id bigint, data jsonb, v_creator_id BIGINT DEFAULT null, content_as_document boolean DEFAULT true)
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
  content_inline public.content_local_input;
  contents_inline public.content_local_input[];
  contents_upsert_result BIGINT[];
BEGIN
  SELECT platform INTO STRICT v_platform FROM public."Space" WHERE id=v_space_id;
  FOR concept_row IN SELECT * FROM jsonb_array_elements(data)
  LOOP
    -- first set defaults
    local_concept := jsonb_populate_record(NULL::public.concept_local_input, '{"epistemic_status": "unknown", "literal_content":{},"reference_content":{},"is_schema":false}');
    -- then input values
    local_concept := jsonb_populate_record(local_concept, concept_row);
    local_concept.space_id := v_space_id;
    BEGIN
        db_concept := public._local_concept_to_db_concept(local_concept);
        IF NOT account_local_id(author_inline(local_concept)) IS NULL THEN
          SELECT public.create_account_in_space(
            v_space_id,
            account_local_id(author_inline(local_concept)),
            name(author_inline(local_concept))
          ) INTO STRICT db_concept.author_id;
        END IF;
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
        -- If the syntax allowed two conflict clauses, I would add
        -- ON CONFLICT (space_id, name) DO NOTHING
        -- but since not, I have to handle it as an exception.
        RETURNING id INTO concept_id;
        IF NOT contents_inline(local_concept) IS NULL THEN
            contents_inline := '{}'::public.content_local_input[];
            IF NOT document_inline(local_concept) IS NULL THEN
                IF author_local_id(document_inline(local_concept)) IS NULL AND author_local_id(local_concept) IS NOT NULL THEN
                    local_concept.document_inline.author_local_id := author_local_id(local_concept);
                END IF;
                IF author_inline(document_inline(local_concept)) IS NULL AND NOT author_inline(local_concept) IS NULL THEN
                    local_concept.document_inline.author_inline := author_inline(local_concept);
                END IF;
                IF created(document_inline(local_concept)) IS NULL  THEN
                    local_concept.document_inline.created := created(local_concept);
                END IF;
                IF last_modified(document_inline(local_concept)) IS NULL THEN
                    local_concept.document_inline.last_modified := last_modified(local_concept);
                END IF;
            END IF;
            FOREACH content_inline IN ARRAY contents_inline(local_concept)
            LOOP
                IF author_id(content_inline) IS NULL AND author_id(local_concept) IS NOT NULL THEN
                    content_inline.author_id := local_concept.author_id;
                ELSIF author_local_id(content_inline) IS NULL AND author_local_id(local_concept) IS NOT NULL THEN
                    content_inline.author_local_id := local_concept.author_local_id;
                ELSIF author_inline(content_inline) IS NULL AND NOT author_inline(local_concept) IS NULL THEN
                    content_inline.author_inline := local_concept.author_inline;
                END IF;
                IF creator_id(content_inline) IS NULL THEN
                    IF creator_local_id(content_inline) IS NULL AND creator_local_id(local_concept) IS NOT NULL THEN
                        content_inline.creator_local_id := local_concept.creator_local_id;
                    ELSIF creator_inline(content_inline) IS NULL AND NOT creator_inline(local_concept) IS NULL THEN
                        content_inline.creator_inline := local_concept.creator_inline;
                    END IF;
                END IF;
                IF document_id(content_inline) IS NULL THEN
                    IF document_local_id(content_inline) IS NULL AND document_local_id(local_concept) IS NOT NULL THEN
                        content_inline.document_local_id := local_concept.document_local_id;
                    ELSIF document_inline(content_inline) IS NULL AND NOT document_inline(local_concept) IS NULL THEN
                        content_inline.document_inline := local_concept.document_inline;
                    END IF;
                END IF;
                IF source_local_id(content_inline) IS NULL AND source_local_id(local_concept) IS NOT NULL THEN
                    content_inline.source_local_id := local_concept.source_local_id;
                END IF;
                IF space_url(content_inline) IS NULL AND space_url(local_concept) IS NOT NULL THEN
                    content_inline.space_url := local_concept.space_url;
                END IF;
                IF created(content_inline) IS NULL AND created(local_concept) IS NOT NULL THEN
                    content_inline.created := local_concept.created;
                END IF;
                IF last_modified(content_inline) IS NULL AND last_modified(local_concept) IS NOT NULL THEN
                    content_inline.last_modified := local_concept.last_modified;
                END IF;
                SELECT array_append(contents_inline, content_inline) INTO contents_inline;
            END LOOP;
            SELECT array_agg(ct) FROM public.upsert_content(v_space_id, to_jsonb(contents_inline), v_creator_id, content_as_document) AS ct INTO contents_upsert_result;
            -- Q: Should we not fail the concept upsert if that content upsert failed? Currently the case.
        END IF;
        RETURN NEXT concept_id;
    EXCEPTION
        WHEN unique_violation THEN
            -- a distinct unique constraint failed
            RAISE WARNING 'Concept with space_id: % and name % already exists', v_space_id, local_concept.name;
            RETURN NEXT -1; -- Return a special value to indicate conflict
        WHEN OTHERS THEN
            -- Null value; probably due to a missing concept.
            RAISE WARNING 'Error in concept upsert: (%) %', SQLSTATE, SQLERRM;
            RETURN NEXT -2; -- Return a special value to indicate error
    END;
  END LOOP;
  RAISE DEBUG 'Completed upsert_concepts successfully';
END;
$$;
