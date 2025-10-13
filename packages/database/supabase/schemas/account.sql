CREATE TYPE public."AgentType" AS ENUM (
    'person',
    'organization',
    'automated_agent',
    'anonymous'
);

ALTER TYPE public."AgentType" OWNER TO postgres;

COMMENT ON TYPE public."AgentType" IS 'The type of agent';

CREATE TYPE public."AgentIdentifierType" AS ENUM (
    'email',
    'orcid'
);

ALTER TYPE public."AgentIdentifierType" OWNER TO postgres;

COMMENT ON TYPE public."AgentIdentifierType" IS 'A namespace for identifiers that can help identify an agent';


CREATE TABLE IF NOT EXISTS public."PlatformAccount" (
    id bigint DEFAULT nextval(
        'public.entity_id_seq'::regclass
    ) NOT NULL PRIMARY KEY,
    name VARCHAR NOT NULL,
    platform public."Platform" NOT NULL,
    account_local_id VARCHAR NOT NULL,
    write_permission BOOLEAN NOT NULL DEFAULT true,
    active BOOLEAN NOT NULL DEFAULT true,
    agent_type public."AgentType" NOT NULL DEFAULT 'person',
    metadata JSONB NOT NULL DEFAULT '{}',
    dg_account UUID,
    FOREIGN KEY (dg_account) REFERENCES auth.users (id) ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE public."PlatformAccount" OWNER TO "postgres";

COMMENT ON TABLE public."PlatformAccount" IS 'An account for an agent on a platform';

CREATE UNIQUE INDEX account_platform_and_id_idx ON public."PlatformAccount" (account_local_id, platform);

REVOKE ALL ON TABLE public."PlatformAccount" FROM anon;
GRANT ALL ON TABLE public."PlatformAccount" TO authenticated;
GRANT ALL ON TABLE public."PlatformAccount" TO service_role;

CREATE TABLE public."AgentIdentifier" (
    identifier_type public."AgentIdentifierType" NOT NULL,
    account_id BIGINT NOT NULL,
    value VARCHAR NOT NULL,
    trusted BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (value, identifier_type, account_id),
    FOREIGN KEY (account_id) REFERENCES public."PlatformAccount" (id)
);

ALTER TABLE public."AgentIdentifier" OWNER TO "postgres";

COMMENT ON TABLE public."AgentIdentifier" IS 'An identifying attribute associated with an account, can be a basis for unification';

REVOKE ALL ON TABLE public."AgentIdentifier" FROM anon;
GRANT ALL ON TABLE public."AgentIdentifier" TO authenticated;
GRANT ALL ON TABLE public."AgentIdentifier" TO service_role;

CREATE INDEX platform_account_dg_account_idx ON public."PlatformAccount" (dg_account);


CREATE TABLE IF NOT EXISTS public."SpaceAccess" (
    space_id bigint,
    account_id bigint NOT NULL,
    editor boolean NOT NULL
);

ALTER TABLE ONLY public."SpaceAccess"
ADD CONSTRAINT "SpaceAccess_pkey" PRIMARY KEY (space_id, account_id);


ALTER TABLE public."SpaceAccess" OWNER TO "postgres";

COMMENT ON TABLE public."SpaceAccess" IS 'An access control entry for a space';

COMMENT ON COLUMN public."SpaceAccess".space_id IS 'The space in which the content is located';

COMMENT ON COLUMN public."SpaceAccess".account_id IS 'The identity of the account in this space';

ALTER TABLE ONLY public."SpaceAccess"
ADD CONSTRAINT "SpaceAccess_account_id_fkey" FOREIGN KEY (
    account_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."SpaceAccess"
ADD CONSTRAINT "SpaceAccess_space_id_fkey" FOREIGN KEY (
    space_id
) REFERENCES public."Space" (
    id
) ON UPDATE CASCADE ON DELETE CASCADE;

GRANT ALL ON TABLE public."SpaceAccess" TO anon;
GRANT ALL ON TABLE public."SpaceAccess" TO authenticated;
GRANT ALL ON TABLE public."SpaceAccess" TO service_role;

CREATE TYPE public.account_local_input AS (
    -- PlatformAccount columns
    name VARCHAR,
    account_local_id VARCHAR,
    -- local values
    email VARCHAR,
    email_trusted BOOLEAN,
    space_editor BOOLEAN
);

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
$$;

CREATE OR REPLACE FUNCTION public.upsert_accounts_in_space(
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
        RETURN NEXT public.upsert_account_in_space(space_id_, local_account);
    END LOOP;
END;
$$;

-- legacy
CREATE OR REPLACE FUNCTION public.create_account_in_space(
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

-- Space: Allow anyone to insert, but only users who are members of the space can update or select

ALTER TABLE public."Space" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS space_policy ON public."Space";
CREATE POLICY space_policy ON public."Space" FOR ALL USING (public.in_space(id));

DROP POLICY IF EXISTS space_insert_policy ON public."Space";
CREATE POLICY space_insert_policy ON public."Space" FOR INSERT WITH CHECK (true);

CREATE OR REPLACE VIEW public.my_spaces AS
SELECT
    id,
    url,
    name,
    platform
FROM public."Space" WHERE id = any(public.my_space_ids());

-- PlatformAccount: Access to anyone sharing a space with you to create an account, to allow editing authors
-- Once the account is claimed by a user, only allow this user to modify it.
-- Eventually: Allow platform admin to modify?

ALTER TABLE public."PlatformAccount" ENABLE ROW LEVEL SECURITY;

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
WHERE sa.space_id = ANY(public.my_space_ids())
GROUP BY pa.id;

DROP POLICY IF EXISTS platform_account_policy ON public."PlatformAccount";
CREATE POLICY platform_account_policy ON public."PlatformAccount" FOR ALL USING (dg_account = (SELECT auth.uid() LIMIT 1) OR (dg_account IS null AND public.unowned_account_in_shared_space(id)));

DROP POLICY IF EXISTS platform_account_select_policy ON public."PlatformAccount";
CREATE POLICY platform_account_select_policy ON public."PlatformAccount" FOR SELECT USING (dg_account = (SELECT auth.uid() LIMIT 1) OR public.account_in_shared_space(id));

-- SpaceAccess: Created through the create_account_in_space and the Space create route, both of which bypass RLS.
-- Can be updated by a space peer for now, unless claimed by a user.
-- Eventually: Allow space admin to modify?

ALTER TABLE public."SpaceAccess" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS space_access_policy ON public."SpaceAccess";
CREATE POLICY space_access_policy ON public."SpaceAccess" FOR ALL USING (public.unowned_account_in_shared_space(account_id) OR account_id = public.my_account());

DROP POLICY IF EXISTS space_access_select_policy ON public."SpaceAccess";
CREATE POLICY space_access_select_policy ON public."SpaceAccess" FOR SELECT USING (public.in_space(space_id));

-- AgentIdentifier: Allow space members to do anything, to allow editing authors.
-- Eventually: Once the account is claimed by a user, only allow this user to modify it.

ALTER TABLE public."AgentIdentifier" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_identifier_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_policy ON public."AgentIdentifier" FOR ALL USING (public.unowned_account_in_shared_space(account_id) OR account_id = public.my_account());

DROP POLICY IF EXISTS agent_identifier_select_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_select_policy ON public."AgentIdentifier" FOR SELECT USING (public.account_in_shared_space(account_id));
