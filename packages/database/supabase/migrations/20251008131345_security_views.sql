ALTER FUNCTION public.my_account RENAME TO is_my_account;

DROP POLICY IF EXISTS access_token_policy ON public.access_token;
CREATE POLICY access_token_policy ON public.access_token FOR ALL USING (platform_account_id IS NULL OR public.is_my_account(platform_account_id));

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

COMMENT ON FUNCTION public.is_my_account IS 'security utility: is this my own account?';

CREATE OR REPLACE FUNCTION public.my_account() RETURNS BIGINT
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    WITH u AS (SELECT auth.uid() LIMIT 1)
    SELECT id FROM public."PlatformAccount" pa
    JOIN u ON pa.dg_account = u.uid LIMIT 1;
$$;

COMMENT ON FUNCTION public.my_account IS 'security utility: id of my account';

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
COMMENT ON FUNCTION public.my_space_ids IS 'security utility: all spaces the user has access to';


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

COMMENT ON FUNCTION public.in_space IS 'security utility: does current user have access to this space?';


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

COMMENT ON FUNCTION public.account_in_shared_space IS 'security utility: does current user share a space with this account?';

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

COMMENT ON FUNCTION public.unowned_account_in_shared_space IS 'security utility: does current user share a space with this unowned account?';

DROP POLICY IF EXISTS platform_account_policy ON public."PlatformAccount";

DROP POLICY IF EXISTS platform_account_select_policy ON public."PlatformAccount";
CREATE POLICY platform_account_select_policy ON public."PlatformAccount" FOR SELECT USING (dg_account = (SELECT auth.uid() LIMIT 1) OR public.account_in_shared_space(id));

DROP POLICY IF EXISTS platform_account_delete_policy ON public."PlatformAccount";
CREATE POLICY platform_account_delete_policy ON public."PlatformAccount" FOR DELETE USING (dg_account = (SELECT auth.uid() LIMIT 1) OR (dg_account IS null AND public.unowned_account_in_shared_space(id)));

DROP POLICY IF EXISTS platform_account_insert_policy ON public."PlatformAccount";
CREATE POLICY platform_account_insert_policy ON public."PlatformAccount" FOR INSERT WITH CHECK (dg_account = (SELECT auth.uid() LIMIT 1) OR (dg_account IS null AND public.unowned_account_in_shared_space(id)));

DROP POLICY IF EXISTS platform_account_update_policy ON public."PlatformAccount";
CREATE POLICY platform_account_update_policy ON public."PlatformAccount" FOR UPDATE WITH CHECK (dg_account = (SELECT auth.uid() LIMIT 1) OR (dg_account IS null AND public.unowned_account_in_shared_space(id)));

DROP POLICY IF EXISTS space_access_policy ON public."SpaceAccess";

DROP POLICY IF EXISTS space_access_select_policy ON public."SpaceAccess";
CREATE POLICY space_access_select_policy ON public."SpaceAccess" FOR SELECT USING (public.in_space(space_id));

DROP POLICY IF EXISTS space_access_delete_policy ON public."SpaceAccess";
CREATE POLICY space_access_delete_policy ON public."SpaceAccess" FOR DELETE USING (public.unowned_account_in_shared_space(account_id) OR account_id = public.my_account());

DROP POLICY IF EXISTS space_access_insert_policy ON public."SpaceAccess";
CREATE POLICY space_access_insert_policy ON public."SpaceAccess" FOR INSERT WITH CHECK (public.unowned_account_in_shared_space(account_id) OR account_id = public.my_account());

DROP POLICY IF EXISTS space_access_update_policy ON public."SpaceAccess";
CREATE POLICY space_access_update_policy ON public."SpaceAccess" FOR UPDATE WITH CHECK (public.unowned_account_in_shared_space(account_id) OR account_id = public.my_account());


DROP POLICY IF EXISTS agent_identifier_policy ON public."AgentIdentifier";

DROP POLICY IF EXISTS agent_identifier_select_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_select_policy ON public."AgentIdentifier" FOR SELECT USING (public.account_in_shared_space(account_id));

DROP POLICY IF EXISTS agent_identifier_delete_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_delete_policy ON public."AgentIdentifier" FOR DELETE USING (public.unowned_account_in_shared_space(account_id) OR account_id = public.my_account());

DROP POLICY IF EXISTS agent_identifier_insert_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_insert_policy ON public."AgentIdentifier" FOR INSERT WITH CHECK (public.unowned_account_in_shared_space(account_id) OR account_id = public.my_account());

DROP POLICY IF EXISTS agent_identifier_update_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_update_policy ON public."AgentIdentifier" FOR UPDATE WITH CHECK (public.unowned_account_in_shared_space(account_id) OR account_id = public.my_account());

CREATE OR REPLACE VIEW public.my_spaces AS
SELECT
    id,
    url,
    name,
    platform
FROM public."Space" WHERE id = any(public.my_space_ids());

CREATE OR REPLACE VIEW public.my_accounts AS
SELECT
    pa.id,
    pa.name,
    pa.platform,
    pa.account_local_id,
    pa.write_permission,
    pa.active,
    pa.agent_type,
    pa.metadata,
    pa.dg_account
FROM public."PlatformAccount" AS pa
WHERE EXISTS (
  SELECT 1
  FROM public."SpaceAccess" AS sa
  WHERE sa.account_id = pa.id
    AND sa.space_id = ANY(public.my_space_ids())
);


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
FROM public."Document" WHERE space_id = any(public.my_space_ids());

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
FROM public."Content" WHERE space_id = any(public.my_space_ids());

CREATE OR REPLACE VIEW public.my_concepts AS
SELECT
    id,
    epistemic_status,
    name,
    description,
    author_id,
    created,
    last_modified,
    space_id,
    arity,
    schema_id,
    literal_content,
    reference_content,
    refs,
    is_schema,
    represented_by_id
FROM public."Concept" WHERE space_id = any(public.my_space_ids());


CREATE OR REPLACE FUNCTION public.schema_of_concept(concept public.my_concepts)
RETURNS SETOF public.my_concepts STRICT STABLE
ROWS 1
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_concepts WHERE id=concept.schema_id;
$$;
COMMENT ON FUNCTION public.schema_of_concept(public.my_concepts)
IS 'Computed one-to-one: returns the schema Concept for a given Concept (by schema_id).';

CREATE OR REPLACE FUNCTION public.instances_of_schema(schema public.my_concepts)
RETURNS SETOF public.my_concepts STRICT STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_concepts WHERE schema_id=schema.id;
$$;
COMMENT ON FUNCTION public.instances_of_schema(public.my_concepts)
IS 'Computed one-to-many: returns all Concept instances that are based on the given schema Concept.';


CREATE OR REPLACE FUNCTION public.concept_in_relations(concept public.my_concepts)
RETURNS SETOF public.my_concepts STRICT STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_concepts WHERE refs @> ARRAY[concept.id];
$$;
COMMENT ON FUNCTION public.concept_in_relations(public.my_concepts)
IS 'Computed one-to-many: returns all Concept instances that are relations including the current concept.';

CREATE OR REPLACE FUNCTION public.concepts_of_relation(relation public.my_concepts)
RETURNS SETOF public.my_concepts STRICT STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_concepts WHERE id = any(relation.refs);
$$;
COMMENT ON FUNCTION public.concepts_of_relation(public.my_concepts)
IS 'Computed one-to-many: returns all Concept instances are referred to in the current concept.';

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

CREATE OR REPLACE FUNCTION public.content_of_concept(concept public.my_concepts)
RETURNS SETOF public.my_contents STRICT STABLE
ROWS 1
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_contents WHERE id=concept.represented_by_id;
$$;
COMMENT ON FUNCTION public.content_of_concept(public.my_concepts)
IS 'Computed one-to-one: returns the representing Content for a given Concept.';

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

CREATE OR REPLACE FUNCTION public.author_of_concept(concept public.my_concepts)
RETURNS SETOF public.my_accounts STRICT STABLE
ROWS 1
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_accounts WHERE id=concept.author_id;
$$;
COMMENT ON FUNCTION public.author_of_concept(public.my_concepts)
IS 'Computed one-to-one: returns the PlatformAccount which authored a given Concept.';

CREATE OR REPLACE VIEW public.my_contents_with_embedding_openai_text_embedding_3_small_1536 AS
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
    emb.model,
    emb.vector
FROM public."Content" AS ct
JOIN public."ContentEmbedding_openai_text_embedding_3_small_1536" AS emb ON (ct.id=emb.target_id)
WHERE ct.space_id = any(public.my_space_ids()) AND NOT emb.obsolete;


CREATE OR REPLACE FUNCTION public.match_content_embeddings (
query_embedding extensions.vector,
match_threshold double precision,
match_count integer,
current_document_id integer DEFAULT NULL::integer)
RETURNS TABLE (
content_id bigint,
roam_uid Text,
text_content Text,
similarity double precision)
SET search_path = 'extensions'
LANGUAGE sql STABLE
AS $$
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
$$ ;

CREATE OR REPLACE FUNCTION public.match_embeddings_for_subset_nodes (
"p_query_embedding" extensions.vector,
"p_subset_roam_uids" Text [])
RETURNS TABLE (content_id bigint,
roam_uid Text,
text_content Text,
similarity double precision)
LANGUAGE sql STABLE
SET search_path = 'extensions'
AS $$
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
$$ ;
