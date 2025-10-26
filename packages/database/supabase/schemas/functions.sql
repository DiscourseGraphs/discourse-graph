-- revokations

REVOKE ALL ON TABLE public."Document" FROM anon;
REVOKE ALL ON TABLE public."Content" FROM anon;
REVOKE ALL ON TABLE public."ContentEmbedding_openai_text_embedding_3_small_1536" FROM anon;
REVOKE ALL ON TABLE public."Concept" FROM anon;
REVOKE ALL ON TABLE public."PlatformAccount" FROM anon;
REVOKE ALL ON TABLE public."AgentIdentifier" FROM anon;
REVOKE DELETE ON TABLE public."access_token" FROM anon;
REVOKE TRUNCATE ON TABLE public."access_token" FROM anon;
REVOKE UPDATE ON TABLE public."access_token" FROM anon;
REVOKE REFERENCES ON TABLE public."access_token" FROM anon;
REVOKE TRIGGER ON TABLE public."access_token" FROM anon;

-- composite types

create type "public"."account_local_input" as ("name" character varying, "account_local_id" character varying, "email" character varying, "email_trusted" boolean, "space_editor" boolean);

create type "public"."document_local_input" as ("space_id" bigint, "source_local_id" character varying, "url" character varying, "created" timestamp without time zone, "metadata" jsonb, "last_modified" timestamp without time zone, "author_id" bigint, "contents" oid, "author_local_id" character varying, "space_url" character varying, "author_inline" account_local_input);

create type "public"."inline_embedding_input" as ("model" character varying, "vector" double precision[]);

create type "public"."content_local_input" as ("document_id" bigint, "source_local_id" character varying, "author_id" bigint, "creator_id" bigint, "created" timestamp without time zone, "text" text, "metadata" jsonb, "scale" "Scale", "space_id" bigint, "last_modified" timestamp without time zone, "part_of_id" bigint, "document_local_id" character varying, "creator_local_id" character varying, "author_local_id" character varying, "part_of_local_id" character varying, "space_url" character varying, "document_inline" document_local_input, "author_inline" account_local_input, "creator_inline" account_local_input, "embedding_inline" inline_embedding_input, "variant" "ContentVariant");

create type "public"."concept_local_input" as ("epistemic_status" "EpistemicStatus", "name" character varying, "description" text, "author_id" bigint, "created" timestamp without time zone, "last_modified" timestamp without time zone, "space_id" bigint, "schema_id" bigint, "literal_content" jsonb, "is_schema" boolean, "represented_by_id" bigint, "reference_content" jsonb, "author_local_id" character varying, "represented_by_local_id" character varying, "schema_represented_by_local_id" character varying, "space_url" character varying, "local_reference_content" jsonb);

-- functions

set check_function_bodies = on;

CREATE OR REPLACE FUNCTION public._local_concept_to_db_concept(data concept_local_input)
 RETURNS "Concept"
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public._local_content_to_db_content(data content_local_input)
 RETURNS "Content"
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
  content public."Content"%ROWTYPE;
  reference_content JSONB := jsonb_build_object();
  key varchar;
  value JSONB;
  ref_single_val BIGINT;
  ref_array_val BIGINT[];
BEGIN
  content := jsonb_populate_record(NULL::public."Content", to_jsonb(data));
  IF data.document_local_id IS NOT NULL THEN
    SELECT id FROM public."Document"
      WHERE source_local_id = data.document_local_id INTO content.document_id;
  END IF;
  IF data.creator_local_id IS NOT NULL THEN
    SELECT id FROM public."PlatformAccount"
      WHERE account_local_id = data.creator_local_id INTO content.creator_id;
  ELSIF account_local_id(creator_inline(data)) IS NOT NULL THEN
    SELECT id FROM public."PlatformAccount"
      WHERE account_local_id = account_local_id(creator_inline(data)) INTO content.creator_id;
  END IF;
  IF data.author_local_id IS NOT NULL THEN
    SELECT id FROM public."PlatformAccount"
      WHERE account_local_id = data.author_local_id INTO content.author_id;
  ELSIF account_local_id(author_inline(data)) IS NOT NULL THEN
    SELECT id FROM public."PlatformAccount"
      WHERE account_local_id = account_local_id(author_inline(data)) INTO content.author_id;
  END IF;
  IF data.part_of_local_id IS NOT NULL THEN
    SELECT id FROM public."Content"
      WHERE source_local_id = data.part_of_local_id INTO content.part_of_id;
  END IF;
  IF data.space_url IS NOT NULL THEN
    SELECT id FROM public."Space"
    WHERE url = data.space_url INTO content.space_id;
  END IF;
  -- now avoid null defaults
  IF content.metadata IS NULL then
    content.metadata := '{}';
  END IF;
  RETURN content;
END;
$function$
;

CREATE OR REPLACE FUNCTION public._local_document_to_db_document(data document_local_input)
 RETURNS "Document"
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
  document public."Document"%ROWTYPE;
  reference_content JSONB := jsonb_build_object();
  key varchar;
  value JSONB;
  ref_single_val BIGINT;
  ref_array_val BIGINT[];
BEGIN
  document := jsonb_populate_record(NULL::public."Document", to_jsonb(data));
  IF data.author_local_id IS NOT NULL THEN
    SELECT id FROM public."PlatformAccount"
      WHERE account_local_id = data.author_local_id INTO document.author_id;
  ELSIF account_local_id(author_inline(data)) IS NOT NULL THEN
    SELECT id FROM public."PlatformAccount"
        WHERE account_local_id = account_local_id(author_inline(data)) INTO document.author_id;
  END IF;
  IF data.space_url IS NOT NULL THEN
    SELECT id FROM public."Space"
    WHERE url = data.space_url INTO document.space_id;
  END IF;
  -- now avoid null defaults
  IF document.metadata IS NULL then
    document.metadata := '{}';
  END IF;
  RETURN document;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.author_of_concept(concept my_concepts)
 RETURNS SETOF my_accounts
 LANGUAGE sql
 STABLE STRICT ROWS 1
 SET search_path TO ''
AS $function$
    SELECT * from public.my_accounts WHERE id=concept.author_id;
$function$
;

CREATE OR REPLACE FUNCTION public.author_of_content(content my_contents)
 RETURNS SETOF my_accounts
 LANGUAGE sql
 STABLE STRICT ROWS 1
 SET search_path TO ''
AS $function$
    SELECT * from public.my_accounts WHERE id=content.author_id;
$function$
;

CREATE OR REPLACE FUNCTION public.concept_in_relations(concept "Concept")
 RETURNS SETOF "Concept"
 LANGUAGE sql
 STABLE STRICT
 SET search_path TO ''
AS $function$
    SELECT * from public."Concept" WHERE refs @> ARRAY[concept.id];
$function$
;

CREATE OR REPLACE FUNCTION public.concept_in_relations(concept my_concepts)
 RETURNS SETOF my_concepts
 LANGUAGE sql
 STABLE STRICT
 SET search_path TO ''
AS $function$
    SELECT * from public.my_concepts WHERE refs @> ARRAY[concept.id];
$function$
;

CREATE OR REPLACE FUNCTION public.concepts_of_relation(relation "Concept")
 RETURNS SETOF "Concept"
 LANGUAGE sql
 STABLE STRICT
 SET search_path TO ''
AS $function$
    SELECT * from public."Concept" WHERE id = any(relation.refs);
$function$
;

CREATE OR REPLACE FUNCTION public.concepts_of_relation(relation my_concepts)
 RETURNS SETOF my_concepts
 LANGUAGE sql
 STABLE STRICT
 SET search_path TO ''
AS $function$
    SELECT * from public.my_concepts WHERE id = any(relation.refs);
$function$
;

CREATE OR REPLACE FUNCTION public.content_of_concept(concept my_concepts)
 RETURNS SETOF my_contents
 LANGUAGE sql
 STABLE STRICT ROWS 1
 SET search_path TO ''
AS $function$
    SELECT * from public.my_contents WHERE id=concept.represented_by_id;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_account_in_space(space_id_ bigint, local_account account_local_input)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    platform_ public."Platform";
    account_id_ BIGINT;
BEGIN
    SELECT platform INTO STRICT platform_ FROM public."Space" WHERE id = space_id_;
    INSERT INTO public."PlatformAccount" AS pa (
            account_local_id, name, platform
        ) VALUES (
            local_account.account_local_id, local_account.name, platform_
        ) ON CONFLICT (account_local_id, platform) DO UPDATE SET
            name = COALESCE(NULLIF(TRIM(EXCLUDED.name), ''), pa.name)
        RETURNING id INTO STRICT account_id_;
    INSERT INTO public."SpaceAccess" as sa (space_id, account_id, editor) values (space_id_, account_id_, COALESCE(local_account.space_editor, true))
        ON CONFLICT (space_id, account_id)
        DO UPDATE SET editor = COALESCE(local_account.space_editor, sa.editor, true);
    IF local_account.email IS NOT NULL THEN
        -- TODO: how to distinguish basic untrusted from platform placeholder email?
        INSERT INTO public."AgentIdentifier" as ai (account_id, value, identifier_type, trusted) VALUES (account_id_, local_account.email, 'email', COALESCE(local_account.email_trusted, false))
        ON CONFLICT (value, identifier_type, account_id)
        DO UPDATE SET trusted = COALESCE(local_account.email_trusted, ai.trusted, false);
    END IF;
    RETURN account_id_;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_account_in_space(space_id_ bigint, account_local_id_ character varying, name_ character varying, email_ character varying DEFAULT NULL::character varying, email_trusted boolean DEFAULT true, editor_ boolean DEFAULT true)
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT public.upsert_account_in_space(space_id_, ROW(name_, account_local_id_ ,email_, email_trusted, editor_)::public.account_local_input);
$function$
;

CREATE OR REPLACE FUNCTION public.document_of_content(content my_contents)
 RETURNS SETOF my_documents
 LANGUAGE sql
 STABLE STRICT ROWS 1
 SET search_path TO ''
AS $function$
    SELECT * from public.my_documents WHERE id=content.document_id;
$function$
;

CREATE OR REPLACE FUNCTION public.end_sync_task(s_target bigint, s_function character varying, s_worker character varying, s_status task_status)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE t_id INTEGER;
DECLARE t_worker varchar;
DECLARE t_status public.task_status;
DECLARE t_failure_count SMALLINT;
DECLARE t_last_task_end TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT id, worker, status, failure_count, last_task_end
        INTO STRICT t_id, t_worker, t_status, t_failure_count, t_last_task_end
        FROM public.sync_info WHERE sync_target = s_target AND sync_function = s_function;
    ASSERT s_status > 'active';
    ASSERT t_worker = s_worker, 'Wrong worker';
    ASSERT s_status >= t_status, 'do not go back in status';
    IF s_status = 'complete' THEN
        t_last_task_end := now();
        t_failure_count := 0;
    ELSE
        IF t_status != s_status THEN
            t_failure_count := t_failure_count + 1;
        END IF;
    END IF;

    UPDATE public.sync_info
        SET status = s_status,
            task_times_out_at=null,
            last_task_end=t_last_task_end,
            failure_count=t_failure_count
        WHERE id=t_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_space_anonymous_email(platform "Platform", space_id bigint)
 RETURNS character varying
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
    SELECT concat(lower(platform::text), '-', space_id, '-anon@database.discoursegraphs.com')
$function$
;


CREATE OR REPLACE FUNCTION public.instances_of_schema(schema "Concept")
 RETURNS SETOF "Concept"
 LANGUAGE sql
 STABLE STRICT
 SET search_path TO ''
AS $function$
    SELECT * from public."Concept" WHERE schema_id=schema.id;
$function$
;

CREATE OR REPLACE FUNCTION public.instances_of_schema(schema my_concepts)
 RETURNS SETOF my_concepts
 LANGUAGE sql
 STABLE STRICT
 SET search_path TO ''
AS $function$
    SELECT * from public.my_concepts WHERE schema_id=schema.id;
$function$
;

CREATE OR REPLACE FUNCTION public.match_content_embeddings(query_embedding vector, match_threshold double precision, match_count integer, current_document_id integer DEFAULT NULL::integer)
 RETURNS TABLE(content_id bigint, roam_uid text, text_content text, similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'extensions'
AS $function$
SELECT
  c.id AS content_id,
  c.source_local_id AS roam_uid,
  c.text AS text_content,
  1 - (c.vector <=> query_embedding) AS similarity
FROM public.my_contents_with_embedding_openai_text_embedding_3_small_1536 AS c
WHERE 1 - (c.vector <=> query_embedding) > match_threshold
  AND (current_document_id IS NULL OR c.document_id = current_document_id)
ORDER BY
  c.vector <=> query_embedding ASC
LIMIT match_count;
$function$
;

CREATE OR REPLACE FUNCTION public.match_embeddings_for_subset_nodes(p_query_embedding vector, p_subset_roam_uids text[])
 RETURNS TABLE(content_id bigint, roam_uid text, text_content text, similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'extensions'
AS $function$
WITH subset_content_with_embeddings AS (
  -- Step 1: Identify content and fetch embeddings ONLY for the nodes in the provided Roam UID subset
  SELECT
    c.id AS content_id,
    c.source_local_id AS roam_uid,
    c.text AS text_content,
    c.vector AS embedding_vector
    FROM public.my_contents_with_embedding_openai_text_embedding_3_small_1536 AS c
  WHERE
    c.source_local_id = ANY(p_subset_roam_uids) -- Filter Content by the provided Roam UIDs
)
SELECT
  ss_ce.content_id,
  ss_ce.roam_uid,
  ss_ce.text_content,
  1 - (ss_ce.embedding_vector <=> p_query_embedding) AS similarity
FROM subset_content_with_embeddings AS ss_ce
ORDER BY similarity DESC; -- Order by calculated similarity, highest first
$function$
;

CREATE OR REPLACE FUNCTION public.propose_sync_task(s_target bigint, s_function character varying, s_worker character varying, timeout interval, task_interval interval)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE s_id INTEGER;
DECLARE start_time TIMESTAMP WITH TIME ZONE := now();
DECLARE t_status public.task_status;
DECLARE t_failure_count SMALLINT;
DECLARE t_last_task_start TIMESTAMP WITH TIME ZONE;
DECLARE t_last_task_end TIMESTAMP WITH TIME ZONE;
DECLARE t_times_out_at TIMESTAMP WITH TIME ZONE;
DECLARE result TIMESTAMP WITH TIME ZONE;
BEGIN
    ASSERT timeout * 2 < task_interval;
    ASSERT timeout >= '1s'::interval;
    ASSERT task_interval >= '5s'::interval;
    INSERT INTO public.sync_info (sync_target, sync_function, status, worker, last_task_start, task_times_out_at)
        VALUES (s_target, s_function, 'active', s_worker, start_time, start_time+timeout)
        ON CONFLICT (sync_target, sync_function) DO NOTHING
        RETURNING id INTO s_id;
    IF s_id IS NOT NULL THEN
        -- totally new_row, I'm on the task
        -- return last time it was run successfully
        SELECT max(last_task_start) INTO result FROM public.sync_info
            WHERE sync_target = s_target
            AND sync_function = s_function
            AND status = 'complete';
        RETURN result;
    END IF;
    -- now we know it pre-existed. Maybe already active.
    SELECT id INTO STRICT s_id FROM public.sync_info WHERE sync_target = s_target AND sync_function = s_function;
    PERFORM pg_advisory_lock(s_id);
    SELECT status, failure_count, last_task_start, last_task_end, task_times_out_at
        INTO t_status, t_failure_count, t_last_task_start, t_last_task_end, t_times_out_at
        FROM public.sync_info
        WHERE id = s_id;

    IF t_status = 'active' AND t_last_task_start >= coalesce(t_last_task_end, t_last_task_start) AND start_time > t_times_out_at THEN
        t_status := 'timeout';
        t_failure_count := t_failure_count + 1;
    END IF;
    -- basic backoff
    task_interval := task_interval * (1+t_failure_count);
    IF coalesce(t_last_task_end, t_last_task_start) + task_interval < now() THEN
        -- we are ready to take on the task
        UPDATE public.sync_info
        SET worker=s_worker, status='active', task_times_out_at = now() + timeout, last_task_start = start_time, failure_count=t_failure_count
        WHERE id=s_id;
    ELSE
        -- the task has been tried recently enough
        IF t_status = 'timeout' THEN
            UPDATE public.sync_info
            SET status=t_status, failure_count=t_failure_count
            WHERE id=s_id;
        END IF;
        result := coalesce(t_last_task_end, t_last_task_start) + task_interval;
    END IF;

    PERFORM pg_advisory_unlock(s_id);
    RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.schema_of_concept(concept "Concept")
 RETURNS SETOF "Concept"
 LANGUAGE sql
 STABLE STRICT ROWS 1
 SET search_path TO ''
AS $function$
    SELECT * from public."Concept" WHERE id=concept.schema_id;
$function$
;

CREATE OR REPLACE FUNCTION public.schema_of_concept(concept my_concepts)
 RETURNS SETOF my_concepts
 LANGUAGE sql
 STABLE STRICT ROWS 1
 SET search_path TO ''
AS $function$
    SELECT * from public.my_concepts WHERE id=concept.schema_id;
$function$
;


CREATE OR REPLACE FUNCTION public.upsert_accounts_in_space(space_id_ bigint, accounts jsonb)
 RETURNS SETOF bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    platform_ public."Platform";
    account_id_ BIGINT;
    account_row JSONB;
    local_account public.account_local_input;
BEGIN
    SELECT platform INTO STRICT platform_ FROM public."Space" WHERE id = space_id_;
    FOR account_row IN SELECT * FROM jsonb_array_elements(accounts)
    LOOP
        local_account := jsonb_populate_record(NULL::public.account_local_input, account_row);
        RETURN NEXT public.upsert_account_in_space(space_id_, local_account);
    END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_concepts(v_space_id bigint, data jsonb)
 RETURNS SETOF bigint
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_content(v_space_id bigint, data jsonb, v_creator_id bigint, content_as_document boolean DEFAULT true)
 RETURNS SETOF bigint
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_platform public."Platform";
  db_document public."Document"%ROWTYPE;
  document_id BIGINT;
  local_content public.content_local_input;
  db_content public."Content"%ROWTYPE;
  content_row JSONB;
  upsert_id BIGINT;
BEGIN
  SELECT platform INTO STRICT v_platform FROM public."Space" WHERE id=v_space_id;
  FOR content_row IN SELECT * FROM jsonb_array_elements(data)
  LOOP
    local_content := jsonb_populate_record(NULL::public.content_local_input, content_row);
    local_content.space_id := v_space_id;
    db_content := public._local_content_to_db_content(local_content);
    IF account_local_id(author_inline(local_content)) IS NOT NULL THEN
      SELECT public.create_account_in_space(
        v_space_id,
        account_local_id(author_inline(local_content)),
        name(author_inline(local_content))
      ) INTO STRICT upsert_id;
      db_content.author_id := upsert_id;
    END IF;
    IF account_local_id(creator_inline(local_content)) IS NOT NULL THEN
      SELECT public.create_account_in_space(
        v_space_id,
        account_local_id(creator_inline(local_content)),
        name(creator_inline(local_content))
      ) INTO STRICT upsert_id;
      db_content.creator_id := upsert_id;
    END IF;
    IF content_as_document THEN
      db_content.scale = 'document';
    END IF;
    IF content_as_document AND document_id(db_content) IS NULL AND source_local_id(document_inline(local_content)) IS NULL THEN
      local_content.document_inline.space_id := v_space_id;
      local_content.document_inline.source_local_id := db_content.source_local_id;
      local_content.document_inline.last_modified := db_content.last_modified;
      local_content.document_inline.created := db_content.created;
      local_content.document_inline.author_id := db_content.author_id;
    END IF;
    IF source_local_id(document_inline(local_content)) IS NOT NULL THEN
      db_document := public._local_document_to_db_document(document_inline(local_content));
      IF (db_document.author_id IS NULL AND author_inline(local_content) IS NOT NULL) THEN
        db_document.author_id := upsert_account_in_space(v_space_id, author_inline(local_content));
      END IF;
      INSERT INTO public."Document" (
        space_id,
        source_local_id,
        url,
        created,
        metadata,
        last_modified,
        author_id,
        contents
      ) VALUES (
        COALESCE(db_document.space_id, v_space_id),
        db_document.source_local_id,
        db_document.url,
        db_document.created,
        COALESCE(db_document.metadata, '{}'::jsonb),
        db_document.last_modified,
        db_document.author_id,
        db_document.contents
      )
      ON CONFLICT (space_id, source_local_id) DO UPDATE SET
          url = COALESCE(db_document.url, EXCLUDED.url),
          created = COALESCE(db_document.created, EXCLUDED.created),
          metadata = COALESCE(db_document.metadata, EXCLUDED.metadata),
          last_modified = COALESCE(db_document.last_modified, EXCLUDED.last_modified),
          author_id = COALESCE(db_document.author_id, EXCLUDED.author_id),
          contents = COALESCE(db_document.contents, EXCLUDED.contents)
      RETURNING id INTO STRICT document_id;
      db_content.document_id := document_id;
    END IF;
    INSERT INTO public."Content" (
        document_id,
        source_local_id,
        variant,
        author_id,
        creator_id,
        created,
        text,
        metadata,
        scale,
        space_id,
        last_modified,
        part_of_id
    ) VALUES (
        db_content.document_id,
        db_content.source_local_id,
        COALESCE(db_content.variant, 'direct'::public."ContentVariant"),
        db_content.author_id,
        db_content.creator_id,
        db_content.created,
        db_content.text,
        COALESCE(db_content.metadata, '{}'::jsonb),
        db_content.scale,
        db_content.space_id,
        db_content.last_modified,
        db_content.part_of_id
    )
    ON CONFLICT (space_id, source_local_id, variant) DO UPDATE SET
        document_id = COALESCE(db_content.document_id, EXCLUDED.document_id),
        author_id = COALESCE(db_content.author_id, EXCLUDED.author_id),
        creator_id = COALESCE(db_content.creator_id, EXCLUDED.creator_id),
        created = COALESCE(db_content.created, EXCLUDED.created),
        text = COALESCE(db_content.text, EXCLUDED.text),
        metadata = COALESCE(db_content.metadata, EXCLUDED.metadata),
        scale = COALESCE(db_content.scale, EXCLUDED.scale),
        last_modified = COALESCE(db_content.last_modified, EXCLUDED.last_modified),
        part_of_id = COALESCE(db_content.part_of_id, EXCLUDED.part_of_id)
    RETURNING id INTO STRICT upsert_id;
    IF model(embedding_inline(local_content)) IS NOT NULL THEN
        PERFORM public.upsert_content_embedding(upsert_id, model(embedding_inline(local_content)),  vector(embedding_inline(local_content)));
    END IF;
    RETURN NEXT upsert_id;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_content_embedding(content_id bigint, model character varying, embedding_array double precision[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    IF  model = 'openai_text_embedding_3_small_1536' AND array_length(embedding_array, 1) = 1536 THEN
        INSERT INTO public."ContentEmbedding_openai_text_embedding_3_small_1536" (target_id, model, vector, obsolete)
            VALUES (content_id, model::public."EmbeddingName", embedding_array::extensions.VECTOR, false)
        ON CONFLICT (target_id)
        DO UPDATE
            SET vector = embedding_array::extensions.VECTOR,
            obsolete = false;
    ELSE
        RAISE WARNING 'Invalid vector name % or length % for embedding', model, array_length(embedding_array, 1);
        -- do not fail just because of the embedding
    END IF;
END
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_documents(v_space_id bigint, data jsonb)
 RETURNS SETOF bigint
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_platform public."Platform";
  local_document public.document_local_input;
  db_document public."Document"%ROWTYPE;
  document_row JSONB;
  upsert_id BIGINT;
BEGIN
  SELECT platform INTO STRICT v_platform FROM public."Space" WHERE id=v_space_id;
  FOR document_row IN SELECT * FROM jsonb_array_elements(data)
  LOOP
    local_document := jsonb_populate_record(NULL::public.document_local_input, document_row);
    local_document.space_id := v_space_id;
    IF account_local_id(author_inline(local_document)) IS NOT NULL THEN
      SELECT public.create_account_in_space(
        v_space_id,
        account_local_id(author_inline(local_document)),
        name(author_inline(local_document))
      ) INTO STRICT upsert_id;
      local_document.author_id := upsert_id;
    END IF;
    db_document := public._local_document_to_db_document(local_document);
    IF (db_document.author_id IS NULL AND author_inline(local_document) IS NOT NULL) THEN
      db_document.author_id := upsert_account_in_space(v_space_id, author_inline(local_document));
    END IF;
    INSERT INTO public."Document" (
        space_id,
        source_local_id,
        url,
        created,
        metadata,
        last_modified,
        author_id,
        contents
    ) VALUES (
        db_document.space_id,
        db_document.source_local_id,
        db_document.url,
        db_document.created,
        db_document.metadata,
        db_document.last_modified,
        db_document.author_id,
        db_document.contents
    )
    ON CONFLICT (space_id, source_local_id) DO UPDATE SET
        author_id = COALESCE(db_document.author_id, EXCLUDED.author_id),
        created = COALESCE(db_document.created, EXCLUDED.created),
        last_modified = COALESCE(db_document.last_modified, EXCLUDED.last_modified),
        url = COALESCE(db_document.url, EXCLUDED.url),
        metadata = COALESCE(db_document.metadata, EXCLUDED.metadata)
    RETURNING id INTO STRICT upsert_id;
    RETURN NEXT upsert_id;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.extract_references(refs JSONB)
RETURNS BIGINT [] IMMUTABLE
SET search_path = ''
LANGUAGE sql
AS $$
  SELECT COALESCE(array_agg(i::bigint), '{}') FROM (SELECT DISTINCT jsonb_array_elements(jsonb_path_query_array(refs, '$.*[*]')) i) exrefs;
$$;

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


CREATE OR REPLACE FUNCTION public.is_my_account(account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    WITH u AS (SELECT auth.uid() LIMIT 1)
    SELECT true FROM public."PlatformAccount" pa
    JOIN u ON pa.dg_account = u.uid
    WHERE pa.id = account_id;
$$;



CREATE OR REPLACE FUNCTION public.my_account() RETURNS BIGINT
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    WITH u AS (SELECT auth.uid() LIMIT 1)
    SELECT id FROM public."PlatformAccount" pa
    JOIN u ON pa.dg_account = u.uid LIMIT 1;
$$;



CREATE OR REPLACE FUNCTION public.my_space_ids() RETURNS BIGINT []
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    WITH u AS (SELECT auth.uid() LIMIT 1)
    SELECT COALESCE(array_agg(distinct sa.space_id), '{}') AS ids FROM public."SpaceAccess" AS sa
        JOIN public."PlatformAccount" AS pa ON pa.id=sa.account_id
        JOIN u ON pa.dg_account = u.uid;
$$;



CREATE OR REPLACE FUNCTION public.in_space(space_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    WITH u AS (SELECT auth.uid() LIMIT 1),
    pa AS (SELECT sa.space_id AS id FROM public."SpaceAccess" AS sa
                JOIN public."PlatformAccount" AS pa ON pa.id=sa.account_id
                JOIN u ON pa.dg_account = u.uid)
    SELECT EXISTS (SELECT id FROM pa WHERE id = space_id );
$$;



CREATE OR REPLACE FUNCTION public.account_in_shared_space(p_account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public."SpaceAccess" AS sa
      WHERE sa.account_id = p_account_id
        AND sa.space_id = ANY(public.my_space_ids())
    );
$$;


CREATE OR REPLACE FUNCTION public.unowned_account_in_shared_space(p_account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public."SpaceAccess" AS sa
      JOIN public."PlatformAccount" AS pa ON (pa.id = sa.account_id)
      WHERE sa.account_id = p_account_id
        AND sa.space_id = ANY(public.my_space_ids())
        AND pa.dg_account IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.concept_in_space(concept_id BIGINT) RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.in_space(space_id) FROM public."Concept" WHERE id=concept_id
$$;


CREATE OR REPLACE FUNCTION public.content_in_space(content_id BIGINT) RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.in_space(space_id) FROM public."Content" WHERE id=content_id
$$;

CREATE OR REPLACE FUNCTION public.document_in_space(document_id BIGINT) RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.in_space(space_id) FROM public."Document" WHERE id=document_id
$$;

CREATE OR REPLACE FUNCTION public.generic_entity_access(target_id BIGINT, target_type public."EntityType") RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT CASE
        WHEN target_type = 'Space' THEN public.in_space(target_id)
        WHEN target_type = 'Content' THEN public.content_in_space(target_id)
        WHEN target_type = 'Concept' THEN public.concept_in_space(target_id)
        WHEN target_type = 'Document' THEN public.document_in_space(target_id)
        WHEN target_type = 'PlatformAccount' THEN public.account_in_shared_space(target_id)
        ELSE false
    END;
$$;

-- trigger functions

CREATE OR REPLACE FUNCTION public.after_delete_space()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    DELETE FROM auth.users WHERE email = public.get_space_anonymous_email(OLD.platform, OLD.id);
    DELETE FROM public."PlatformAccount"
        WHERE platform = OLD.platform
        AND account_local_id = public.get_space_anonymous_email(OLD.platform, OLD.id);
    RETURN NEW;
END;
$function$
;

-- triggers

CREATE TRIGGER on_delete_space_trigger AFTER DELETE ON public."Space" FOR EACH ROW EXECUTE FUNCTION after_delete_space();
