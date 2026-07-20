ALTER TABLE ONLY public."Content"
ADD COLUMN original BOOLEAN DEFAULT true;

ALTER TYPE public."content_local_input" ADD ATTRIBUTE original BOOLEAN;

ALTER TABLE ONLY public."FileReference"
DROP CONSTRAINT IF EXISTS "FileReference_content_fkey";

ALTER TABLE public."FileReference"
ADD COLUMN original BOOLEAN GENERATED ALWAYS AS (true) STORED;

DROP INDEX IF EXISTS public.content_space_local_id_variant_idx;

CREATE UNIQUE INDEX IF NOT EXISTS content_space_local_id_variant_content_type_idx ON public."Content" USING btree (
    space_id, source_local_id, variant, content_type
) NULLS DISTINCT;

CREATE UNIQUE INDEX IF NOT EXISTS content_space_local_id_variant_content_type_originals_idx ON public."Content" USING btree (
    space_id, source_local_id, variant, original
);

ALTER TABLE ONLY public."FileReference"
ADD CONSTRAINT "FileReference_content_fkey" FOREIGN KEY (
    space_id, source_local_id, variant, original
) REFERENCES public."Content"(space_id, source_local_id, variant, original) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public._local_content_to_db_content(data public.content_local_input)
RETURNS public."Content" STABLE
SET search_path = ''
LANGUAGE plpgsql AS $$
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
  content.original := CASE WHEN data.original IS false THEN NULL ELSE true END;
  -- now avoid null defaults
  IF content.metadata IS NULL then
    content.metadata := '{}';
  END IF;
  IF content.content_type IS NULL THEN
    content.content_type := 'text/plain';
  END IF;
  RETURN content;
END;
$$;

COMMENT ON FUNCTION public._local_content_to_db_content IS 'utility function so we have the option to use platform identifiers for content upsert';

CREATE OR REPLACE FUNCTION public.upsert_content(v_space_id bigint, data jsonb, v_creator_id BIGINT, content_as_document boolean DEFAULT true)
RETURNS SETOF BIGINT
SET search_path = ''
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
      IF content_type(document_inline(local_content)) IS NULL THEN
        local_content.document_inline.content_type := CASE
          WHEN v_platform='Roam' THEN 'text/roam+markdown'
          WHEN v_platform='Obsidian' THEN 'text/obsidian+markdown'
          ELSE 'text/plain' END;
      END IF;
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
        contents,
        content_type
      ) VALUES (
        COALESCE(db_document.space_id, v_space_id),
        db_document.source_local_id,
        db_document.url,
        db_document.created,
        COALESCE(db_document.metadata, '{}'::jsonb),
        db_document.last_modified,
        db_document.author_id,
        db_document.contents,
        db_document.content_type
      )
      ON CONFLICT (space_id, source_local_id) DO UPDATE SET
          url = COALESCE(db_document.url, EXCLUDED.url),
          created = COALESCE(db_document.created, EXCLUDED.created),
          metadata = COALESCE(db_document.metadata, EXCLUDED.metadata),
          last_modified = COALESCE(db_document.last_modified, EXCLUDED.last_modified),
          author_id = COALESCE(db_document.author_id, EXCLUDED.author_id),
          contents = COALESCE(db_document.contents, EXCLUDED.contents),
          content_type = COALESCE(db_document.content_type, EXCLUDED.content_type)
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
        part_of_id,
        content_type,
        original
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
        db_content.part_of_id,
        db_content.content_type,
        db_content.original
    )
    ON CONFLICT (space_id, source_local_id, variant, content_type) DO UPDATE SET
        document_id = COALESCE(db_content.document_id, EXCLUDED.document_id),
        author_id = COALESCE(db_content.author_id, EXCLUDED.author_id),
        creator_id = COALESCE(db_content.creator_id, EXCLUDED.creator_id),
        created = COALESCE(db_content.created, EXCLUDED.created),
        text = COALESCE(db_content.text, EXCLUDED.text),
        metadata = COALESCE(db_content.metadata, EXCLUDED.metadata),
        scale = COALESCE(db_content.scale, EXCLUDED.scale),
        last_modified = COALESCE(db_content.last_modified, EXCLUDED.last_modified),
        part_of_id = COALESCE(db_content.part_of_id, EXCLUDED.part_of_id),
        original = db_content.original
    RETURNING id INTO STRICT upsert_id;
    IF model(embedding_inline(local_content)) IS NOT NULL THEN
        PERFORM public.upsert_content_embedding(upsert_id, model(embedding_inline(local_content)),  vector(embedding_inline(local_content)));
    END IF;
    RETURN NEXT upsert_id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.upsert_content IS 'batch content upsert';

DROP VIEW public.my_contents_with_embedding_openai_text_embedding_3_small_1536;

CREATE VIEW public.my_contents_with_embedding_openai_text_embedding_3_small_1536 AS
SELECT
    ct.id,
    ct.document_id,
    ct.source_local_id,
    ct.variant,
    ct.author_id,
    ct.creator_id,
    ct.created,
    ct.text,
    ct.metadata,
    ct.scale,
    ct.space_id,
    ct.last_modified,
    ct.part_of_id,
    ct.content_type,
    ct.original,
    emb.model,
    emb.vector
FROM public."Content" AS ct
    JOIN public."ContentEmbedding_openai_text_embedding_3_small_1536" AS emb ON (ct.id = emb.target_id)
    LEFT OUTER JOIN public.my_accessible_resources() AS ra USING (space_id, source_local_id)
WHERE (
    ct.space_id = any(public.my_space_ids('reader'))
    OR (ct.space_id = any(public.my_space_ids('partial')) AND ra.space_id IS NOT null)
)
AND NOT emb.obsolete;

CREATE OR REPLACE VIEW public.my_contents AS
SELECT
    id,
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
    part_of_id,
    content_type,
    original
FROM public."Content"
    LEFT OUTER JOIN public.my_accessible_resources() AS ra USING (space_id, source_local_id)
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR (space_id = any(public.my_space_ids('partial')) AND ra.space_id IS NOT null)
);
