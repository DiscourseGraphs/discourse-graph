CREATE TYPE public."ContentVariant" AS ENUM (
    'direct',
    'direct_and_children',
    'direct_and_description'
);

ALTER TYPE public."ContentVariant" OWNER TO postgres;

ALTER TABLE public."Content" ADD COLUMN variant public."ContentVariant" NOT NULL DEFAULT 'direct';

DROP INDEX IF EXISTS public."content_space_and_local_id_idx";

CREATE UNIQUE INDEX content_space_local_id_variant_idx ON public."Content" USING btree (space_id, source_local_id, variant);

ALTER TYPE public.content_local_input ADD ATTRIBUTE variant public."ContentVariant";

CREATE OR REPLACE FUNCTION public.upsert_content(v_space_id bigint, data jsonb, v_creator_id BIGINT, content_as_document boolean DEFAULT true)
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
      local_content.author_id := upsert_id;
    END IF;
    IF account_local_id(creator_inline(local_content)) IS NOT NULL THEN
      SELECT public.create_account_in_space(
        v_space_id,
        account_local_id(creator_inline(local_content)),
        name(creator_inline(local_content))
      ) INTO STRICT upsert_id;
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
$$;
