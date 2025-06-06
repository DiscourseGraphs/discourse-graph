-- It may be appropriate to upsert many documents before upserting the corresponding nodes
CREATE OR REPLACE FUNCTION public.upsert_documents(data jsonb, creator_uid varchar, space_url varchar)
 RETURNS SETOF BIGINT
 LANGUAGE plpgsql
AS $$
DECLARE
  v_space_id bigint;
  v_platform public."Platform";
  v_creator_id bigint;
  document JSONB;
BEGIN
  SELECT id, platform INTO STRICT v_space_id, v_platform FROM public."Space" WHERE url = space_url;
  -- creator_id, may be null
  SELECT id INTO v_creator_id FROM public."PlatformAccount" WHERE account_local_id=creator_uid AND platform = v_platform.id;

  -- Process each document
  FOR document IN SELECT * FROM jsonb_array_elements(data)
  LOOP
    DECLARE
      v_document_local_id VARCHAR = document->>'local_id';
      v_document_author_local_id VARCHAR = document->>'author_local_id';
      v_document_created TIMESTAMP = (document->>'created')::TIMESTAMPTZ;
      v_document_last_modified TIMESTAMP = (document->>'last_modified')::TIMESTAMPTZ;
      v_document_author_id BIGINT;
      v_document_id BIGINT;
    BEGIN

    RAISE NOTICE 'Processing document with UID: %', v_document_local_id;
    SELECT id INTO STRICT v_document_author_id FROM public."PlatformAccount" WHERE account_local_id = v_document_author_local_id;
    -- upsert document. Note that some variables being null will cause failure, as desired.
    INSERT INTO public."Document" (platform, source_local_id, author_id, created, last_modified) VALUES (
      v_platform, v_document_local_id, v_document_author_id, v_document_created, v_document_last_modified
    ) ON CONFLICT (platform, source_local_id)
    DO UPDATE SET
      author_id = v_document_author_id,
      created = v_document_created,
      last_modified = v_document_last_modified
    RETURNING id INTO STRICT v_document_id;

    RETURN NEXT v_document_id;
  END;
  END LOOP;

  RAISE NOTICE 'Completed upsert_documents successfully';
END;
$$;


-- function to upsert many content objects
-- example data content where the block is distinct from the document:
-- [
--   {
--     "local_id": "a_roam_uid",
--     "space_url": "http://roamresearch.com/#/app/developer-documentation",
--     "author_local_id": "a_roam_user_uid",
--     "created": "2021-08-01T12:00:0Z",
--     "last_modified": "2021-08-01T12:00:0Z",
--     "text": "the roam block's text",
--     "scale": "block",
--     "embedding_name": "openai_text_embedding_3_small_1536",
--     "embedding_vector": [0, 0.1, ...],
--     "metadate": {...},
--     "document": {
--       "local_id": "a_roam_page_uid",
--       "author_local_id": "a_roam_user_uid",
--       "created": "2021-08-01T12:00:0Z",
--       "last_modified": "2021-08-01T12:00:0Z",
--     },
--   }
-- ]
-- In the case of discourse nodes, you can set content_as_document and not give the document sub-field
-- If you want to mix, set the local_id of the document to the local_id of the content, when appropriate, other fields will be taken from the document.
-- If the document exists in the database (eg. through upsert_documents) you need only provide the local_id.

CREATE OR REPLACE FUNCTION public.upsert_content(data jsonb, creator_uid varchar,  space_url varchar, content_as_document boolean default false)
 RETURNS SETOF BIGINT
 LANGUAGE plpgsql
AS $$
DECLARE
  v_space_id bigint;
  v_platform public."Platform";
  v_creator_id bigint;
  content JSONB;
BEGIN
  SELECT id, platform FROM public."Space" WHERE url = space_url INTO STRICT v_space_id, v_platform;
  -- creator_id, may be null
  SELECT id INTO v_creator_id FROM public."PlatformAccount" WHERE account_local_id=creator_uid AND platform = v_platform.id;

  -- Process each content
  FOR content IN SELECT * FROM jsonb_array_elements(data)
  LOOP
    DECLARE
      v_content_local_id VARCHAR := content->>'local_id';
      v_content_document JSONB = COALESCE(content -> 'document', '{}'::JSONB);
      v_document_local_id VARCHAR = v_content_document->>'local_id';
      v_document_author_local_id VARCHAR = v_content_document->>'author_local_id';
      v_document_created TIMESTAMP = (v_content_document->>'created')::TIMESTAMPTZ;
      v_document_last_modified TIMESTAMP = (v_content_document->>'last_modified')::TIMESTAMPTZ;
      v_content_author_local_id VARCHAR = content ->>'author_local_id';
      v_content_scale public."Scale" := (content ->> 'scale')::public."Scale";
      v_content_text TEXT := content->>'text';
      v_content_created TIMESTAMPTZ := (content->>'created')::TIMESTAMPTZ;
      v_content_last_modified TIMESTAMPTZ := (content->>'last_modified')::TIMESTAMPTZ;
      v_content_metadata JSONB := content -> 'metadata';
      v_content_part_of_local_id VARCHAR := content ->> 'part_of_local_id';
      v_content_embedding_name VARCHAR :=  content ->> 'embedding_name';
      v_content_document_id BIGINT;
      v_content_author_id BIGINT;
      v_part_of_id BIGINT;
      v_document_author_id BIGINT;
      v_content_id BIGINT;
    BEGIN

    RAISE NOTICE 'Processing content with UID: %', v_content_local_id;
    IF content_as_document OR v_document_local_id = v_content_local_id THEN
      v_content_scale := COALESCE(v_content_scale, 'document'::public."Scale");
      v_document_local_id := COALESCE(v_document_local_id, v_content_local_id);
      v_document_author_local_id := v_content_author_local_id;
      v_document_created := v_content_created;
      v_document_last_modified := v_content_last_modified;
    END IF;
    SELECT id FROM public."Document" WHERE source_local_id = v_document_local_id INTO v_content_document_id;
    IF v_content_document_id IS NULL THEN
      -- upsert document. Note that some variables being null will cause failure, as desired.
      SELECT id INTO STRICT v_document_author_id FROM public."PlatformAccount" WHERE account_local_id = v_document_author_local_id;
      INSERT INTO public."Document" (platform, source_local_id, author_id, created, last_modified) VALUES (
        v_platform, v_document_local_id, v_document_author_id, v_document_created, v_document_last_modified
      ) ON CONFLICT (platform, source_local_id)
      DO UPDATE SET
        author_id = v_document_author_id,
        created = v_document_created,
        last_modified = v_document_last_modified
      RETURNING id INTO STRICT v_content_document_id;
      IF v_document_author_local_id = v_content_author_local_id THEN
        v_content_author_id = v_document_author_id;
      END IF;
    END IF;
    IF v_content_author_id IS NULL THEN
      SELECT id INTO STRICT v_content_author_id FROM public."PlatformAccount" WHERE account_local_id = v_content_author_local_id;
    END IF;
    IF v_content_part_of_local_id IS NOT NULL THEN
      -- If strict, this would requires that containers are inserted before content. Right now let's just lose the information but that loses data.
      SELECT id INTO v_content_part_of_local_id FROM public."Content" WHERE source_local_id = v_content_part_of_local_id;
    END IF;
    INSERT INTO public."Content" (platform, source_local_id, document_id, scale, "text", author_id, creator_id, created, last_modified, metadata) VALUES (
      v_platform, source_local_id, v_document_id, v_content_scale, v_content_text, v_content_author_id, v_creator_id, v_content_created, v_content_last_modified
    ) ON CONFLICT (platform, source_local_id)
    DO UPDATE SET
      document_id = v_document_id,
      scale = v_scale,
      "text" = v_text,
      author_id = v_document_author_id,
      creator_id = COALESCE(creator_id, v_creator_id),
      created = v_document_created,
      last_modified = v_document_last_modified,
      metadata = COALESCE(metadata, v_content_metadata)
    RETURNING id INTO STRICT v_content_id;

    -- I would actually prefer to do this in a separate function
    IF v_content_embedding_name IS NOT NULL AND v_content -> 'embedding_vector' IS NOT NULL THEN
      IF  v_content_embedding_name = 'openai_text_embedding_3_small_1536' AND jsonb_array_length(v_content -> 'embedding_vector') = 1532 THEN
        DECLARE
          v_content_embedding_vector extensions.VECTOR(1532);
        BEGIN
          WITH vq AS (SELECT value::float FROM jsonb_array_elements(v_content -> 'embedding_vector'))
            SELECT array_agg(value)::vector INTO v_content_embedding_vector FROM q;
          INSERT INTO "ContentEmbedding_openai_text_embedding_3_small_1536" (target_id, model, vector, obsolete)
            VALUES (v_content_id, v_content_embedding_name, v_content_embedding_vector, false)
          ON CONFLICT (v_content_id, v_content_embedding_name)
          DO UPDATE
            SET vector = v_content_embedding_vector,
            obsolete = false;
        END;
      ELSE
        RAISE WARNING 'Invalid vector name %s or length %s for embedding', v_content_embedding_name, jsonb_array_length(v_content -> 'embedding_vector');
        -- do not fail just because of the embedding
      END IF;
    END IF;

    RETURN NEXT v_content_id;
  END;
  END LOOP;

  RAISE NOTICE 'Completed upsert_content successfully';
END;
$$;
