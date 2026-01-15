CREATE OR REPLACE FUNCTION public.rid_to_space_id_and_local_id(rid VARCHAR)
RETURNS public.accessible_resource STRICT STABLE
SET search_path = ''
LANGUAGE plpgsql AS $$
DECLARE
    uri VARCHAR;
    source_local_id VARCHAR;
    source_id BIGINT;
BEGIN
source_local_id := split_part(rid, '/', -1);
IF length(source_local_id) = length(rid) THEN
    RETURN (null, 'Not a Rid')::public.accessible_resource;
END IF;
uri := substr(rid, 1, length(rid) - length(source_local_id) - 1);
IF rid ~ '^orn:\w+\.\w+:.*$' THEN
    uri := concat(split_part(split_part(uri, ':', 2), '.', 1), ':', split_part(uri, ':', 3));
ELSE
    IF rid ~ '^orn:\w+:.*$' THEN
        uri := substr(uri, 5);
    END IF;
END IF;
SELECT id INTO source_id FROM public."Space" where url=uri;
IF source_id IS NULL THEN
    RETURN (null, concat('Cannot find ', uri))::public.accessible_resource;
END IF;
RETURN (source_id, source_local_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.rid_or_local_id_to_concept_db_id(rid VARCHAR, default_space_id BIGINT)
RETURNS BIGINT STRICT STABLE
SET search_path = ''
LANGUAGE plpgsql AS $$
DECLARE r public.accessible_resource;
BEGIN
    r := (SELECT public.rid_to_space_id_and_local_id(rid));
    IF r.space_id IS NULL THEN
        RETURN  (SELECT id FROM public."Concept" WHERE space_id = default_space_id AND source_local_id = rid);
    ELSE
        RETURN (SELECT id FROM public."Concept" WHERE space_id = r.space_id AND source_local_id = r.source_local_id);
    END IF;
END;
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
