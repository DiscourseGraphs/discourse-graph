CREATE TYPE public."Scale" AS ENUM (
    'document',
    'post',
    'chunk_unit',
    'section',
    'block',
    'field',
    'paragraph',
    'quote',
    'sentence',
    'phrase'
);

ALTER TYPE public."Scale" OWNER TO postgres;

CREATE TYPE public."ContentVariant" AS ENUM (
    'direct',
    'direct_and_children',
    'direct_and_description',
    'full'
);

ALTER TYPE public."ContentVariant" OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public."Document" (
    id bigint DEFAULT nextval(
        'public.entity_id_seq'::regclass
    ) NOT NULL,
    space_id bigint,
    source_local_id character varying,
    url character varying,
    "created" timestamp without time zone NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_modified timestamp without time zone NOT NULL,
    author_id bigint NOT NULL,
    contents oid
);

ALTER TABLE ONLY public."Document"
ADD CONSTRAINT "Document_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY public."Document"
ADD CONSTRAINT "Document_author_id_fkey" FOREIGN KEY (
    author_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."Document"
ADD CONSTRAINT "Document_space_id_fkey" FOREIGN KEY (
    space_id
) REFERENCES public."Space" (
    id
) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE UNIQUE INDEX document_space_and_local_id_idx ON public."Document" USING btree (space_id, source_local_id)
NULLS DISTINCT;

CREATE UNIQUE INDEX document_url_idx ON public."Document" USING btree (url);

ALTER TABLE public."Document" OWNER TO "postgres";

COMMENT ON COLUMN public."Document".space_id IS 'The space in which the content is located';

COMMENT ON COLUMN public."Document".source_local_id IS 'The unique identifier of the content in the remote source';

COMMENT ON COLUMN public."Document".created IS 'The time when the content was created in the remote source';

COMMENT ON COLUMN public."Document".last_modified IS 'The last time the content was modified in the remote source';

COMMENT ON COLUMN public."Document".author_id IS 'The author of content';

COMMENT ON COLUMN public."Document".contents IS 'A large object OID for the downloaded raw content';


CREATE TABLE IF NOT EXISTS public."Content" (
    id bigint DEFAULT nextval(
        'public.entity_id_seq'::regclass
    ) NOT NULL,
    document_id bigint NOT NULL,
    source_local_id character varying,
    variant public."ContentVariant" NOT NULL DEFAULT 'direct',
    author_id bigint,
    creator_id bigint,
    created timestamp without time zone NOT NULL,
    text text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    scale public."Scale" NOT NULL,
    space_id bigint,
    last_modified timestamp without time zone NOT NULL,
    part_of_id bigint
);

ALTER TABLE ONLY public."Content"
ADD CONSTRAINT "Content_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY public."Content"
ADD CONSTRAINT "Content_author_id_fkey" FOREIGN KEY (
    author_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Content"
ADD CONSTRAINT "Content_creator_id_fkey" FOREIGN KEY (
    creator_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Content"
ADD CONSTRAINT "Content_document_id_fkey" FOREIGN KEY (
    document_id
) REFERENCES public."Document" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."Content"
ADD CONSTRAINT "Content_part_of_id_fkey" FOREIGN KEY (
    part_of_id
) REFERENCES public."Content" (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Content"
ADD CONSTRAINT "Content_space_id_fkey" FOREIGN KEY (
    space_id
) REFERENCES public."Space" (
    id
) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX "Content_document" ON public."Content" USING btree (
    document_id
);

CREATE INDEX "Content_part_of" ON public."Content" USING btree (
    part_of_id
);

CREATE INDEX "Content_space" ON public."Content" USING btree (space_id);

CREATE UNIQUE INDEX content_space_local_id_variant_idx ON public."Content" USING btree (
    space_id, source_local_id, variant
) NULLS DISTINCT;

CREATE INDEX "Content_text" ON public."Content" USING pgroonga (text);

ALTER TABLE public."Content" OWNER TO "postgres";

COMMENT ON TABLE public."Content" IS 'A unit of content';

COMMENT ON COLUMN public."Content".source_local_id IS 'The unique identifier of the content in the remote source';

COMMENT ON COLUMN public."Content".author_id IS 'The author of content';

COMMENT ON COLUMN public."Content".creator_id IS 'The creator of a logical structure, such as a content subdivision';

COMMENT ON COLUMN public."Content".created IS 'The time when the content was created in the remote source';

COMMENT ON COLUMN public."Content".space_id IS 'The space in which the content is located';

COMMENT ON COLUMN public."Content".last_modified IS 'The last time the content was modified in the remote source';

COMMENT ON COLUMN public."Content".part_of_id IS 'This content is part of a larger content unit';

CREATE TABLE IF NOT EXISTS public."ResourceAccess" (
    account_uid UUID NOT NULL,
    space_id bigint NOT NULL,
    source_local_id CHARACTER VARYING NOT NULL
);

ALTER TABLE ONLY public."ResourceAccess"
ADD CONSTRAINT "ResourceAccess_pkey" PRIMARY KEY (account_uid, source_local_id, space_id);

ALTER TABLE public."ResourceAccess" OWNER TO "postgres";

COMMENT ON TABLE public."ResourceAccess" IS 'An access control entry for a content';

COMMENT ON COLUMN public."ResourceAccess".space_id IS 'The space_id of the content item for which access is granted';
COMMENT ON COLUMN public."ResourceAccess".source_local_id IS 'The source_local_id of the content item for which access is granted';

COMMENT ON COLUMN public."ResourceAccess".account_uid IS 'The identity of the user account';

ALTER TABLE ONLY public."ResourceAccess"
ADD CONSTRAINT "ResourceAccess_account_uid_fkey" FOREIGN KEY (
    account_uid
) REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX resource_access_content_local_id_idx ON public."ResourceAccess" (source_local_id, space_id);

-- note that I cannot have a foreign key for Content because the variant is part of the unique key.

GRANT ALL ON TABLE public."ResourceAccess" TO authenticated;
GRANT ALL ON TABLE public."ResourceAccess" TO service_role;
REVOKE ALL ON TABLE public."ResourceAccess" FROM anon;

REVOKE ALL ON TABLE public."Document" FROM anon;
GRANT ALL ON TABLE public."Document" TO authenticated;
GRANT ALL ON TABLE public."Document" TO service_role;

REVOKE ALL ON TABLE public."Content" FROM anon;
GRANT ALL ON TABLE public."Content" TO authenticated;
GRANT ALL ON TABLE public."Content" TO service_role;

CREATE OR REPLACE FUNCTION public.can_view_specific_resource(space_id_ BIGINT, source_local_id_ VARCHAR) RETURNS BOOLEAN
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS(
        SELECT true FROM public."ResourceAccess"
        JOIN public.my_user_accounts() ON (account_uid=my_user_accounts)
        WHERE space_id=space_id_
        AND source_local_id = source_local_id_
        LIMIT 1);
$$;

-- explicit fields require more maintenance, but respects declared table order.
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
    contents
FROM
    public."Document" WHERE space_id = any(public.my_space_ids('reader'))
OR public.can_view_specific_resource(space_id, source_local_id);

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
    part_of_id
FROM public."Content"
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR public.can_view_specific_resource(space_id, source_local_id)
);

CREATE OR REPLACE FUNCTION public.document_of_content(content public.my_contents)
RETURNS SETOF public.my_documents STRICT STABLE
ROWS 1
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_documents WHERE id=content.document_id;
$$;
COMMENT ON FUNCTION public.document_of_content(public.my_contents)
IS 'Computed one-to-one: returns the containing Document for a given Content.';

CREATE OR REPLACE FUNCTION public.author_of_content(content public.my_contents)
RETURNS SETOF public.my_accounts STRICT STABLE
ROWS 1
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_accounts WHERE id=content.author_id;
$$;
COMMENT ON FUNCTION public.author_of_content(public.my_contents)
IS 'Computed one-to-one: returns the PlatformAccount which authored a given Content.';

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
    author_inline public.account_local_input
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
    author_inline public.account_local_input,
    creator_inline public.account_local_input,
    embedding_inline public.inline_embedding_input,
    variant public."ContentVariant"
);


-- private function. Transform document with local (platform) references to document with db references
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

COMMENT ON FUNCTION public._local_document_to_db_document IS 'utility function so we have the option to use platform identifiers for document upsert';

-- private function. Transform content with local (platform) references to content with db references
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

COMMENT ON FUNCTION public._local_content_to_db_content IS 'utility function so we have the option to use platform identifiers for content upsert';

-- The data should be an array of LocalDocumentDataInput
-- Documents are upserted, based on space_id and local_id. New (or old) IDs are returned.
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

COMMENT ON FUNCTION public.upsert_documents IS 'batch document upsert';

CREATE OR REPLACE FUNCTION public.upsert_content_embedding(content_id bigint, model varchar, embedding_array float []) RETURNS VOID
SET search_path = ''
LANGUAGE plpgsql
AS $$
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
$$;

COMMENT ON FUNCTION public.upsert_content_embedding IS 'single content embedding upsert';

-- The data should be an array of LocalContentDataInput
-- Contents are upserted, based on space_id and local_id. New (or old) IDs are returned.
-- This may trigger creation of PlatformAccounts and Documents appropriately.
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

COMMENT ON FUNCTION public.upsert_content IS 'batch content upsert';

CREATE OR REPLACE FUNCTION public.content_in_space(content_id BIGINT, access_level public."SpaceAccessPermissions" = 'reader') RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.in_space(space_id, access_level) FROM public."Content" WHERE id=content_id
$$;

COMMENT ON FUNCTION public.content_in_space IS 'security utility: does current user have access to this content''s space?';

CREATE OR REPLACE FUNCTION public.document_in_space(document_id BIGINT) RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.in_space(space_id) FROM public."Document" WHERE id=document_id
$$;

COMMENT ON FUNCTION public.document_in_space IS 'security utility: does current user have access to this document''s space?';

ALTER TABLE public."Document" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_policy ON public."Document";
DROP POLICY IF EXISTS document_select_policy ON public."Document";
CREATE POLICY document_select_policy ON public."Document" FOR SELECT USING (public.in_space(space_id) OR public.can_view_specific_resource(space_id, source_local_id));
DROP POLICY IF EXISTS document_delete_policy ON public."Document";
CREATE POLICY document_delete_policy ON public."Document" FOR DELETE USING (public.in_space(space_id));
DROP POLICY IF EXISTS document_insert_policy ON public."Document";
CREATE POLICY document_insert_policy ON public."Document" FOR INSERT WITH CHECK (public.in_space(space_id));
DROP POLICY IF EXISTS document_update_policy ON public."Document";
CREATE POLICY document_update_policy ON public."Document" FOR UPDATE USING (public.in_space(space_id));

ALTER TABLE public."Content" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_policy ON public."Content";
DROP POLICY IF EXISTS content_select_policy ON public."Content";
CREATE POLICY content_select_policy ON public."Content" FOR SELECT USING (public.in_space(space_id) OR public.can_view_specific_resource(space_id, source_local_id));
DROP POLICY IF EXISTS content_delete_policy ON public."Content";
CREATE POLICY content_delete_policy ON public."Content" FOR DELETE USING (public.in_space(space_id));
DROP POLICY IF EXISTS content_insert_policy ON public."Content";
CREATE POLICY content_insert_policy ON public."Content" FOR INSERT WITH CHECK (public.in_space(space_id));
DROP POLICY IF EXISTS content_update_policy ON public."Content";
CREATE POLICY content_update_policy ON public."Content" FOR UPDATE USING (public.in_space(space_id));

ALTER TABLE public."ResourceAccess" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_access_policy ON public."ResourceAccess";
DROP POLICY IF EXISTS resource_access_select_policy ON public."ResourceAccess";
CREATE POLICY resource_access_select_policy ON public."ResourceAccess" FOR SELECT USING (public.in_space(space_id) OR public.can_access_account(account_uid));
DROP POLICY IF EXISTS resource_access_delete_policy ON public."ResourceAccess";
CREATE POLICY resource_access_delete_policy ON public."ResourceAccess" FOR DELETE USING (public.in_space(space_id, 'editor') OR public.can_access_account(account_uid));
DROP POLICY IF EXISTS resource_access_insert_policy ON public."ResourceAccess";
CREATE POLICY resource_access_insert_policy ON public."ResourceAccess" FOR INSERT WITH CHECK (public.in_space(space_id, 'editor'));
DROP POLICY IF EXISTS resource_access_update_policy ON public."ResourceAccess";
CREATE POLICY resource_access_update_policy ON public."ResourceAccess" FOR UPDATE USING (public.in_space(space_id, 'editor'));
