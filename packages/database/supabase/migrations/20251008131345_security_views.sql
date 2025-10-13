ALTER FUNCTION public.my_account RENAME TO is_my_account;

DROP POLICY IF EXISTS access_token_policy ON public.access_token;
CREATE POLICY access_token_policy ON public.access_token FOR ALL USING (public.is_my_account(platform_account_id));

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
    SELECT count(sa.account_id) > 0 FROM public."SpaceAccess" AS sa
    WHERE sa.account_id = p_account_id
    AND sa.space_id = ANY(public.my_space_ids());
$$;

COMMENT ON FUNCTION public.account_in_shared_space IS 'security utility: does current user share a space with this account?';

CREATE OR REPLACE FUNCTION public.unowned_account_in_shared_space(p_account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT count(sa.account_id) > 0 FROM public."SpaceAccess" AS sa
    JOIN public."PlatformAccount" AS pa ON (pa.id = sa.account_id)
    WHERE sa.account_id = p_account_id
    AND sa.space_id = ANY(public.my_space_ids())
    AND pa.dg_account IS NULL;
$$;

COMMENT ON FUNCTION public.unowned_account_in_shared_space IS 'security utility: does current user share a space with this unowned account?';

DROP POLICY IF EXISTS platform_account_policy ON public."PlatformAccount";
CREATE POLICY platform_account_policy ON public."PlatformAccount" FOR ALL USING (dg_account = (SELECT auth.uid() LIMIT 1) OR (dg_account IS null AND public.unowned_account_in_shared_space(id)));

DROP POLICY IF EXISTS platform_account_select_policy ON public."PlatformAccount";
CREATE POLICY platform_account_select_policy ON public."PlatformAccount" FOR SELECT USING (dg_account = (SELECT auth.uid() LIMIT 1) OR public.account_in_shared_space(id));

DROP POLICY IF EXISTS space_access_policy ON public."SpaceAccess";
CREATE POLICY space_access_policy ON public."SpaceAccess" FOR ALL USING (public.unowned_account_in_shared_space(account_id) OR account_id = public.my_account());

DROP POLICY IF EXISTS space_access_select_policy ON public."SpaceAccess";
CREATE POLICY space_access_select_policy ON public."SpaceAccess" FOR SELECT USING (public.in_space(space_id));

DROP POLICY IF EXISTS agent_identifier_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_policy ON public."AgentIdentifier" FOR ALL USING (public.unowned_account_in_shared_space(account_id) OR account_id = public.my_account());

DROP POLICY IF EXISTS agent_identifier_select_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_select_policy ON public."AgentIdentifier" FOR SELECT USING (public.account_in_shared_space(account_id));

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
JOIN public."SpaceAccess" AS sa ON (sa.account_id = pa.id)
WHERE sa.space_id = ANY(public.my_space_ids());


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
