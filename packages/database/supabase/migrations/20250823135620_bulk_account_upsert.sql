CREATE TYPE public.account_local_input AS (
-- PlatformAccount columns
name VARCHAR,
account_local_id VARCHAR,
-- local values
email VARCHAR,
email_trusted BOOLEAN,
space_editor BOOLEAN
) ;

CREATE OR REPLACE FUNCTION public.upsert_account_in_space(
    space_id_ BIGINT,
    local_account public.account_local_input
) RETURNS BIGINT
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
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
            name = coalesce(local_account.name, pa.name)
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
$$;

CREATE OR REPLACE FUNCTION public.upsert_accounts_in_space (
space_id_ BIGINT,
accounts JSONB
) RETURNS SETOF BIGINT
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
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
        RETURN NEXT public.upsert_account_in_space(space_id, local_account);
    END LOOP;
END;
$$;

-- legacy
CREATE OR REPLACE FUNCTION public.create_account_in_space (
space_id_ BIGINT,
account_local_id_ varchar,
name_ varchar,
email_ varchar = null,
email_trusted boolean = true,
editor_ boolean = true
) RETURNS BIGINT
SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.upsert_account_in_space(space_id_, ROW(name_, account_local_id_ ,email_, email_trusted, editor_)::public.account_local_input);
$$ ;

ALTER TYPE public.document_local_input ALTER ATTRIBUTE author_inline TYPE public.account_local_input ;

ALTER TYPE public.content_local_input ALTER ATTRIBUTE author_inline TYPE public.account_local_input ;
ALTER TYPE public.content_local_input ALTER ATTRIBUTE creator_inline TYPE public.account_local_input ;

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
  RETURN document;
END;
$$;

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
  -- now avoid null defaults
  IF content.metadata IS NULL then
    content.metadata := '{}';
  END IF;
  RETURN content;
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
$$;

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
$$;
