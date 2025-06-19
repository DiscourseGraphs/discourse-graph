CREATE TYPE public.document_local_input AS (
    -- document columns
    space_id bigint,
    source_local_id character varying,
    url character varying,
    "created" timestamp without time zone,
    metadata jsonb,
    last_modified timestamp without time zone,
    author_id bigint,
    contents oid,
    -- local values
    author_local_id character varying,
    space_url character varying,
    -- inline values
    author_inline public."PlatformAccount"
);

CREATE TYPE public.inline_embedding_input AS (
    model varchar,
    vector float []
);

CREATE TYPE public.content_local_input AS (
    -- content columns
    document_id bigint,
    source_local_id character varying,
    author_id bigint,
    creator_id bigint,
    created timestamp without time zone,
    text text,
    metadata jsonb,
    scale public."Scale",
    space_id bigint,
    last_modified timestamp without time zone,
    part_of_id bigint,
    -- local values
    document_local_id character varying,
    creator_local_id character varying,
    author_local_id character varying,
    part_of_local_id character varying,
    space_url character varying,
    -- inline values
    document_inline public.document_local_input,
    author_inline public."PlatformAccount",
    creator_inline public."PlatformAccount",
    embedding_inline public.inline_embedding_input
);


-- local function
CREATE OR REPLACE FUNCTION public._local_document_to_db_document(data public.document_local_input) RETURNS public."Document" LANGUAGE plpgsql STABLE AS $$
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
$$;

COMMENT ON FUNCTION public._local_document_to_db_document IS 'utility function so we have the option to use platform identifiers for document upsert' ;

-- local function
CREATE OR REPLACE FUNCTION public._local_content_to_db_content (data public.content_local_input) RETURNS public."Content" LANGUAGE plpgsql STABLE AS $$
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
  END IF;
  IF data.author_local_id IS NOT NULL THEN
    SELECT id FROM public."PlatformAccount"
      WHERE account_local_id = data.author_local_id INTO content.author_id;
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
$$ ;

COMMENT ON FUNCTION public._local_content_to_db_content IS 'utility function so we have the option to use platform identifiers for content upsert' ;

CREATE OR REPLACE FUNCTION public.upsert_platform_account_input (account_info public."PlatformAccount", p_platform public."Platform")
RETURNS BIGINT
LANGUAGE sql
AS $$
    INSERT INTO public."PlatformAccount" (
      name,
      platform,
      account_local_id,
      write_permission,
      active,
      agent_type,
      metadata
      -- Do not overwrite dg_account from the platform
    ) VALUES (
      name(account_info),
      COALESCE(platform(account_info), p_platform),
      account_local_id(account_info),
      COALESCE(write_permission(account_info), true),
      COALESCE(active(account_info), true),
      COALESCE(agent_type(account_info), 'person'),
      COALESCE(metadata(account_info), '{}')
    )
    ON CONFLICT (account_local_id, platform) DO UPDATE SET
      name = COALESCE(name(account_info), EXCLUDED.name),
      write_permission = COALESCE(write_permission(account_info), EXCLUDED.write_permission, true),
      active = COALESCE(active(account_info), EXCLUDED.active, true),
      agent_type = COALESCE(agent_type(account_info), EXCLUDED.agent_type, 'person'),
      metadata = COALESCE(metadata(account_info), EXCLUDED.metadata, '{}')
  RETURNING id;
$$ ;


CREATE OR REPLACE FUNCTION public.upsert_documents (v_space_id bigint, data jsonb)
RETURNS SETOF BIGINT
LANGUAGE plpgsql
AS $$
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
      SELECT upsert_platform_account_input(author_inline(local_document), v_platform) INTO STRICT upsert_id;
      local_document.author_id := upsert_id;
    END IF;
    db_document := public._local_document_to_db_document(local_document);
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
$$ ;

COMMENT ON FUNCTION public.upsert_documents IS 'batch document upsert' ;

CREATE OR REPLACE FUNCTION public.upsert_content_embedding (content_id bigint, model varchar, embedding_array float []) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF  model = 'openai_text_embedding_3_small_1536' AND array_length(embedding_array, 1) = 1536 THEN
        INSERT INTO "ContentEmbedding_openai_text_embedding_3_small_1536" (target_id, model, vector, obsolete)
            VALUES (content_id, model::public."EmbeddingName", embedding_array::VECTOR, false)
        ON CONFLICT (target_id)
        DO UPDATE
            SET vector = embedding_array::VECTOR,
            obsolete = false;
    ELSE
        RAISE WARNING 'Invalid vector name % or length % for embedding', model, array_length(embedding_array, 1);
        -- do not fail just because of the embedding
    END IF;
END
$$ ;

COMMENT ON FUNCTION public.upsert_content_embedding IS 'single content embedding upsert' ;


CREATE OR REPLACE FUNCTION public.upsert_content (v_space_id bigint, data jsonb, v_creator_id BIGINT, content_as_document boolean DEFAULT true)
RETURNS SETOF BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_platform public."Platform";
  db_document public."Document"%ROWTYPE;
  document_id BIGINT;
  local_content public.content_local_input;
  db_content public."Content"%ROWTYPE;
  content_row JSONB;
  upsert_id BIGINT;
BEGIN
  raise notice 'upsert content: %', data;
  SELECT platform INTO STRICT v_platform FROM public."Space" WHERE id=v_space_id;
  FOR content_row IN SELECT * FROM jsonb_array_elements(data)
  LOOP
    raise notice 'Content row: %', content_row;
    local_content := jsonb_populate_record(NULL::public.content_local_input, content_row);
    local_content.space_id := v_space_id;
    db_content := public._local_content_to_db_content(local_content);
    IF account_local_id(author_inline(local_content)) IS NOT NULL THEN
      SELECT upsert_platform_account_input(author_inline(local_content), v_platform) INTO STRICT upsert_id;
      local_content.author_id := upsert_id;
    END IF;
    IF account_local_id(creator_inline(local_content)) IS NOT NULL THEN
      SELECT upsert_platform_account_input(creator_inline(local_content), v_platform) INTO STRICT upsert_id;
      local_content.creator_id := upsert_id;
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
      local_content.document_inline.metadata := '{}';
    END IF;
    IF source_local_id(document_inline(local_content)) IS NOT NULL THEN
      db_document := _local_document_to_db_document(document_inline(local_content));
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
        db_content.author_id,
        db_content.creator_id,
        db_content.created,
        db_content.text,
        db_content.metadata,
        db_content.scale,
        db_content.space_id,
        db_content.last_modified,
        db_content.part_of_id
    )
    ON CONFLICT (space_id, source_local_id) DO UPDATE SET
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
$$ ;

COMMENT ON FUNCTION public.upsert_content IS 'batch content upsert' ;
