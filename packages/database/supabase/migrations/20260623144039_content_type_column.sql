ALTER TABLE public."Document" ADD COLUMN content_type character varying NOT NULL DEFAULT 'text/plain';
ALTER TABLE public."Content" ADD COLUMN content_type character varying NOT NULL DEFAULT 'text/plain';

UPDATE public."Content" SET content_type = 'text/obsidian+markdown' WHERE variant = 'full';
UPDATE public."Document" SET content_type = 'text/obsidian+markdown' WHERE space_id IN (SELECT id FROM public."Space" WHERE platform = 'Obsidian');
UPDATE public."Document" SET content_type = 'application/roam+json' WHERE space_id IN (SELECT id FROM public."Space" WHERE platform = 'Roam');

CREATE OR REPLACE VIEW public.my_documents AS
SELECT
    id,
    space_id,
    source_local_id,
    url,
    "created",
    metadata,
    last_modified,
    author_id,
    contents,
    content_type
FROM
    public."Document"
    LEFT OUTER JOIN public.my_accessible_resources() AS ra USING (space_id, source_local_id)
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR (space_id = any(public.my_space_ids('partial')) AND ra.space_id IS NOT NULL)
);

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
    content_type
FROM public."Content"
    LEFT OUTER JOIN public.my_accessible_resources() AS ra USING (space_id, source_local_id)
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR (space_id = any(public.my_space_ids('partial')) AND ra.space_id IS NOT NULL)
);

ALTER TYPE public.document_local_input ADD ATTRIBUTE content_type character varying;
ALTER TYPE public.content_local_input ADD ATTRIBUTE content_type character varying;

CREATE OR REPLACE FUNCTION public._local_document_to_db_document(data public.document_local_input)
RETURNS public."Document" LANGUAGE plpgsql STABLE
SET search_path = ''
AS $$
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
  IF document.content_type IS NULL THEN
    document.content_type = 'text/plain';
  END IF;
  RETURN document;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_documents(v_space_id bigint, data jsonb)
RETURNS SETOF BIGINT
SET search_path = ''
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
        contents,
        content_type
    ) VALUES (
        db_document.space_id,
        db_document.source_local_id,
        db_document.url,
        db_document.created,
        db_document.metadata,
        db_document.last_modified,
        db_document.author_id,
        db_document.contents,
        db_document.content_type
    )
    ON CONFLICT (space_id, source_local_id) DO UPDATE SET
        author_id = COALESCE(db_document.author_id, EXCLUDED.author_id),
        created = COALESCE(db_document.created, EXCLUDED.created),
        last_modified = COALESCE(db_document.last_modified, EXCLUDED.last_modified),
        url = COALESCE(db_document.url, EXCLUDED.url),
        metadata = COALESCE(db_document.metadata, EXCLUDED.metadata),
        content_type = COALESCE(db_document.content_type, EXCLUDED.content_type)
    RETURNING id INTO STRICT upsert_id;
    RETURN NEXT upsert_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_content(v_space_id bigint, data jsonb, v_creator_id BIGINT, content_as_document boolean DEFAULT TRUE)
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
          WHEN v_platform='Roam' THEN 'application/roam+json'
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
        content_type
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
        db_content.content_type
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
        part_of_id = COALESCE(db_content.part_of_id, EXCLUDED.part_of_id),
        content_type = COALESCE(db_content.content_type, EXCLUDED.content_type)
    RETURNING id INTO STRICT upsert_id;
    IF model(embedding_inline(local_content)) IS NOT NULL THEN
        PERFORM public.upsert_content_embedding(upsert_id, model(embedding_inline(local_content)),  vector(embedding_inline(local_content)));
    END IF;
    RETURN NEXT upsert_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_concepts(v_space_id bigint, data jsonb, v_creator_id BIGINT DEFAULT null, content_as_document boolean DEFAULT true)
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
                IF content_type(document_inline(local_concept)) IS NULL THEN
                  local_concept.document_inline.content_type := CASE
                    WHEN v_platform='Roam' THEN 'application/roam+json'
                    WHEN v_platform='Obsidian' THEN 'text/obsidian+markdown'
                    ELSE 'text/plain' END;
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
                IF content_type(content_inline) IS NULL THEN
                    content_inline.content_type := 'text/plain';
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
                    IF content_type(document_inline(content_inline)) IS NULL THEN
                      content_inline.document_inline.content_type := CASE
                        WHEN v_platform='Roam' THEN 'application/roam+json'
                        WHEN v_platform='Obsidian' THEN 'text/obsidian+markdown'
                        ELSE 'text/plain' END;
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
