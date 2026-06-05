-- Everyone pseudo-user

CREATE OR REPLACE FUNCTION public.everyone_uid() RETURNS UUID
IMMUTABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT '00000000-0000-0000-0000-000000000000'::uuid;
$$;

COMMENT ON FUNCTION public.everyone_uid IS 'The uid of the everyone pseudo-user. A grant to it applies to every caller, logged in or not.';

-- The ResourceAccess select policy calls it as the caller.
GRANT EXECUTE ON FUNCTION public.everyone_uid TO anon;

INSERT INTO auth.users (instance_id, id, aud, role, created_at, updated_at, is_super_admin, is_anonymous)
VALUES (public.everyone_uid(), public.everyone_uid(), 'anon', 'anon', now(), now(), false, true)
ON CONFLICT (id) DO NOTHING;

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

-- Clients cannot set who owns an account (dg_account) or change what identifies it (agent_type, platform, account_local_id).
-- Clients create and upsert accounts through upsert_account_in_space, which also adds the account to the space.
-- Clients cannot read dg_account, which would show which accounts belong to one person, or metadata, which nothing uses yet.
-- Reads and updates are granted per column: a new column is hidden from clients until it is added to these grants.
REVOKE SELECT, INSERT, UPDATE ON TABLE public."PlatformAccount" FROM authenticated;
GRANT SELECT (id, name, platform, account_local_id, write_permission, active, agent_type) ON TABLE public."PlatformAccount" TO authenticated;
GRANT UPDATE (name, active) ON TABLE public."PlatformAccount" TO authenticated;

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

CREATE INDEX platform_account_dg_account_idx ON public."PlatformAccount" (dg_account);


CREATE TABLE IF NOT EXISTS public."LocalAccess" (
    account_id bigint NOT NULL,
    space_id bigint NOT NULL
);

ALTER TABLE public."LocalAccess" OWNER TO "postgres";

ALTER TABLE public."LocalAccess" ADD CONSTRAINT "LocalAccess_pkey" PRIMARY KEY (account_id, space_id);

COMMENT ON TABLE public."LocalAccess" IS 'A record of which platform accounts have used this space';

COMMENT ON COLUMN public."LocalAccess".space_id IS 'The space in which the content is located';

COMMENT ON COLUMN public."LocalAccess".account_id IS 'The identity of the local account in this space';

ALTER TABLE ONLY public."LocalAccess"
ADD CONSTRAINT "LocalAccess_account_id_fkey" FOREIGN KEY (
    account_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."LocalAccess"
ADD CONSTRAINT "LocalAccess_space_id_fkey" FOREIGN KEY (
    space_id
) REFERENCES public."Space" (
    id
) ON UPDATE CASCADE ON DELETE CASCADE;


CREATE TYPE public."SpaceAccessPermissions" AS ENUM (
    'partial',
    'reader',
    'editor'
);

CREATE TABLE IF NOT EXISTS public."SpaceAccess" (
    account_uid UUID NOT NULL,
    space_id bigint NOT NULL,
    permissions public."SpaceAccessPermissions" NOT NULL
);

ALTER TABLE ONLY public."SpaceAccess"
ADD CONSTRAINT "SpaceAccess_pkey" PRIMARY KEY (account_uid, space_id);

ALTER TABLE public."SpaceAccess" OWNER TO "postgres";

-- Every caller, anon included, gets the everyone pseudo-user's permissions, so it must never edit.
ALTER TABLE public."SpaceAccess" ADD CONSTRAINT "SpaceAccess_everyone_read_only" CHECK (
    account_uid <> public.everyone_uid() OR permissions <= 'reader'
);

COMMENT ON TABLE public."SpaceAccess" IS 'An access control entry for a space';

COMMENT ON COLUMN public."SpaceAccess".space_id IS 'The space in which the content is located';

COMMENT ON COLUMN public."SpaceAccess".account_uid IS 'The identity of the user account';

COMMENT ON COLUMN public."SpaceAccess".permissions IS 'The permission this account has on this space';

ALTER TABLE ONLY public."SpaceAccess"
ADD CONSTRAINT "SpaceAccess_account_uid_fkey" FOREIGN KEY (
    account_uid
) REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."SpaceAccess"
ADD CONSTRAINT "SpaceAccess_space_id_fkey" FOREIGN KEY (
    space_id
) REFERENCES public."Space" (
    id
) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.group_membership (
    member_id UUID NOT NULL,
    group_id UUID NOT NULL,
    admin BOOLEAN DEFAULT true
);

ALTER TABLE public.group_membership
ADD CONSTRAINT group_membership_pkey PRIMARY KEY (member_id, group_id);

CREATE INDEX IF NOT EXISTS group_membership_group_idx ON public.group_membership (group_id);

ALTER TABLE public.group_membership OWNER TO "postgres";

COMMENT ON TABLE public.group_membership IS 'A group membership table';
COMMENT ON COLUMN public.group_membership.member_id IS 'The member of the group';
COMMENT ON COLUMN public.group_membership.group_id IS 'The group identifier';

ALTER TABLE ONLY public.group_membership
ADD CONSTRAINT "group_membership_member_id_fkey" FOREIGN KEY (
    member_id
) REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership
ADD CONSTRAINT "group_membership_group_id_fkey" FOREIGN KEY (
    group_id
) REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE OR REPLACE VIEW public.my_groups AS
SELECT id, split_part(email, '@', 1) AS name FROM auth.users
    JOIN public.group_membership ON (group_id = id)
WHERE member_id = auth.uid();

REVOKE INSERT, UPDATE, DELETE ON public.my_groups FROM authenticated;
GRANT SELECT ON public.my_groups TO anon;

CREATE TYPE public.account_local_input AS (
    -- PlatformAccount columns
    name VARCHAR,
    account_local_id VARCHAR,
    -- local values
    email VARCHAR,
    email_trusted BOOLEAN,
    space_editor BOOLEAN,
    permissions public."SpaceAccessPermissions"
);


CREATE OR REPLACE FUNCTION public.my_platform_account_ids() RETURNS SETOF BIGINT
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT id FROM public."PlatformAccount" WHERE dg_account = auth.uid();
$$;

COMMENT ON FUNCTION public.my_platform_account_ids IS 'security utility: the platform accounts I own. Takes no row column, so a policy runs it once per query.';

-- The planner can't inline this function, and its default estimate of 1000 rows makes it scan SpaceAccess instead of using the primary key.
-- The caller plus their groups is usually a few rows. Measured on generated data: above 10, plans get worse as SpaceAccess grows.
CREATE OR REPLACE FUNCTION public.my_user_accounts() RETURNS SETOF UUID
STABLE SECURITY DEFINER
ROWS 10
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT auth.uid() WHERE auth.uid() IS NOT NULL UNION
    SELECT public.everyone_uid() UNION
    SELECT group_id FROM public.group_membership
    WHERE member_id = auth.uid();
$$;

COMMENT ON FUNCTION public.my_user_accounts IS 'security utility: The uids which give me access: myself, my groups, and the everyone pseudo-user.';
-- Public access: base of the my_* views and of most helpers.
GRANT EXECUTE ON FUNCTION public.my_user_accounts TO anon;

CREATE OR REPLACE FUNCTION public.my_identity_accounts() RETURNS SETOF UUID
STABLE SECURITY DEFINER
ROWS 10
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT auth.uid() WHERE auth.uid() IS NOT NULL UNION
    SELECT group_id FROM public.group_membership
    WHERE member_id = auth.uid();
$$;

COMMENT ON FUNCTION public.my_identity_accounts IS 'security utility: The uids I act as, myself or a group I belong to. Excludes the everyone pseudo-user, so a public grant never counts as sharing a space.';
-- Public access: the my_accounts view and the account helpers.
GRANT EXECUTE ON FUNCTION public.my_identity_accounts TO anon;

CREATE OR REPLACE FUNCTION public.my_permissions_in_space(
    space_id_ BIGINT
) RETURNS public."SpaceAccessPermissions"
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT max(permissions) FROM public."SpaceAccess"
    JOIN public.my_user_accounts() ON (account_uid = my_user_accounts)
    WHERE space_id=space_id_;
$$;

-- Not SECURITY DEFINER: runs as the caller under RLS.
GRANT EXECUTE ON FUNCTION public.my_permissions_in_space TO anon;

CREATE OR REPLACE FUNCTION public.in_group(group_id_ UUID) RETURNS BOOLEAN
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS (SELECT true FROM public.group_membership
        WHERE member_id = auth.uid() AND group_id = group_id_);
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(group_id_ UUID) RETURNS BOOLEAN
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS (SELECT true FROM public.group_membership
        WHERE member_id = auth.uid() AND group_id = group_id_ AND admin);
$$;

CREATE OR REPLACE FUNCTION public.my_space_ids(access_level public."SpaceAccessPermissions" = 'reader') RETURNS BIGINT []
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT COALESCE(array_agg(distinct space_id), '{}') AS ids
        FROM public."SpaceAccess"
        JOIN public.my_user_accounts() ON (account_uid = my_user_accounts)
        WHERE permissions >= access_level;
$$;
COMMENT ON FUNCTION public.my_space_ids IS 'security utility: all spaces the user has access to';
-- Space select policy; anon can read Space. Public access: the my_* views and the other select policies.
GRANT EXECUTE ON FUNCTION public.my_space_ids TO anon;

CREATE OR REPLACE FUNCTION public.in_space(space_id BIGINT, access_level public."SpaceAccessPermissions" = 'reader') RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS (SELECT 1 FROM public."SpaceAccess" AS sa
        JOIN public.my_user_accounts() ON (sa.account_uid = my_user_accounts)
        WHERE sa.space_id = in_space.space_id AND sa.permissions >= access_level);
$$;

COMMENT ON FUNCTION public.in_space IS 'security utility: does current user have access to this space?';
-- anon can't execute it. Only write paths reach it as the caller, through concept_in_space and content_in_space; anon's reads use my_space_ids. A new policy that anon's queries reach must not call it.

CREATE OR REPLACE FUNCTION public.account_ids_in_shared_spaces(access_level public."SpaceAccessPermissions" = 'reader')
RETURNS TABLE (account_id BIGINT, unowned BOOLEAN)
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT DISTINCT la.account_id, pa.dg_account IS NULL
    FROM public."SpaceAccess" AS sa
    JOIN public.my_identity_accounts() AS my (uid) ON (sa.account_uid = my.uid)
    JOIN public."LocalAccess" AS la USING (space_id)
    JOIN public."PlatformAccount" AS pa ON (pa.id = la.account_id)
    WHERE sa.permissions >= access_level;
$$;

COMMENT ON FUNCTION public.account_ids_in_shared_spaces IS 'security utility: the accounts in spaces where I have at least this access level, and whether each is unowned. Takes no row column, so a policy runs it once per query.';


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
    -- This function bypasses RLS, so it must check access itself.
    IF NOT public.in_space(space_id_, 'editor') THEN
        RAISE EXCEPTION 'Editor access to space % required', space_id_
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    SELECT platform INTO STRICT platform_ FROM public."Space" WHERE id = space_id_;
    INSERT INTO public."PlatformAccount" AS pa (
            account_local_id, name, platform
        ) VALUES (
            local_account.account_local_id, local_account.name, platform_
        ) ON CONFLICT (account_local_id, platform) DO UPDATE SET
            name = COALESCE(NULLIF(TRIM(EXCLUDED.name), ''), pa.name)
        RETURNING id INTO STRICT account_id_;
    INSERT INTO public."LocalAccess" (space_id, account_id) values (space_id_, account_id_)
        ON CONFLICT (space_id, account_id)
        DO NOTHING;
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
    permissions_ public."SpaceAccessPermissions" = 'editor'
) RETURNS BIGINT
SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.upsert_account_in_space(space_id_, ROW(name_, account_local_id_ ,email_, email_trusted, null, permissions_)::public.account_local_input);
$$;

COMMENT ON FUNCTION public.upsert_account_in_space IS 'Add an account to a space the caller can edit. Grants no SpaceAccess: the space_editor and permissions fields of the input are ignored.';
COMMENT ON FUNCTION public.upsert_accounts_in_space IS 'Add accounts to a space the caller can edit, through upsert_account_in_space.';
COMMENT ON FUNCTION public.create_account_in_space IS 'Legacy wrapper of upsert_account_in_space; permissions_ is ignored.';

-- Space: Allow anyone to insert, but only users who are members of the space can update or select

ALTER TABLE public."Space" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS space_policy ON public."Space";
DROP POLICY IF EXISTS space_select_policy ON public."Space";
CREATE POLICY space_select_policy ON public."Space" FOR SELECT USING (id = any((SELECT public.my_space_ids('partial'))::bigint []));
DROP POLICY IF EXISTS space_delete_policy ON public."Space";
CREATE POLICY space_delete_policy ON public."Space" FOR DELETE USING (id = any((SELECT public.my_space_ids('editor'))::bigint []));
DROP POLICY IF EXISTS space_update_policy ON public."Space";
CREATE POLICY space_update_policy ON public."Space" FOR UPDATE USING (id = any((SELECT public.my_space_ids('editor'))::bigint []));
-- No insert policy: clients cannot insert into Space. See space.sql.
DROP POLICY IF EXISTS space_insert_policy ON public."Space";

CREATE OR REPLACE VIEW public.my_spaces AS
SELECT
    id,
    url,
    name,
    platform
FROM public."Space" WHERE id = any(public.my_space_ids('partial'));

-- Single-table views are writable, and writes run as the view owner, bypassing Space's RLS.
REVOKE INSERT, UPDATE, DELETE ON public.my_spaces FROM authenticated;
GRANT SELECT ON public.my_spaces TO anon;

-- PlatformAccount: Editors of a space can change or delete its unowned accounts, to allow editing authors.
-- Clients create accounts through the account functions.
-- Once the account is claimed by a user, only allow this user to modify it.
-- Eventually: Allow platform admin to modify?

ALTER TABLE public."PlatformAccount" ENABLE ROW LEVEL SECURITY;

-- Leaves out dg_account, which would show which accounts belong to one person, and metadata, which nothing uses yet.
-- The real name only shows to callers who share a space with the account through their own grants.
-- An account visible only through a public grant shows as 'anonymous #<id>'.
CREATE OR REPLACE VIEW public.my_accounts AS
SELECT
    id,
    CASE WHEN id IN (
        SELECT "LocalAccess".account_id FROM public."LocalAccess"
            JOIN public."SpaceAccess" USING (space_id)
            JOIN public.my_identity_accounts() ON (account_uid = my_identity_accounts)
        WHERE permissions >= 'partial'
        UNION
        SELECT id FROM public."PlatformAccount" WHERE dg_account = auth.uid()
    ) THEN name ELSE ('anonymous #' || id)::varchar END AS name,
    platform,
    account_local_id,
    write_permission,
    active,
    agent_type
FROM public."PlatformAccount"
WHERE id IN (
    SELECT "LocalAccess".account_id FROM public."LocalAccess"
        JOIN public."SpaceAccess" USING (space_id)
        JOIN public.my_user_accounts() ON (account_uid = my_user_accounts)
    WHERE permissions >= 'partial'
    UNION
    SELECT id FROM public."PlatformAccount" WHERE dg_account = auth.uid()
);

-- Single-table views are writable, and writes run as the view owner, bypassing PlatformAccount's RLS.
REVOKE INSERT, UPDATE, DELETE ON public.my_accounts FROM authenticated;
GRANT SELECT ON public.my_accounts TO anon;

-- Definer view on purpose: inside a policy, LocalAccess is filtered by its own reader-level select policy, so an inline check can't see partial access.
-- Unlike a function, the planner can inline a view, so a policy can check one account without building the whole set.
-- Keep DISTINCT and don't add space_id: LocalAccess only shows memberships at reader level, and one row per membership would reveal them.
-- security_barrier stops a caller's non-leakproof filter from running below the access join, where it would see accounts of other spaces.
CREATE OR REPLACE VIEW public.accounts_in_my_partial_spaces WITH (security_barrier) AS
SELECT DISTINCT la.account_id
FROM public."SpaceAccess" AS sa
    JOIN public.my_identity_accounts() AS my (uid) ON (sa.account_uid = my.uid)
    JOIN public."LocalAccess" AS la USING (space_id)
WHERE sa.permissions >= 'partial';

COMMENT ON VIEW public.accounts_in_my_partial_spaces IS 'security utility: the accounts in spaces where I have at least partial access. Used by the PlatformAccount select policy.';

-- Uses my_identity_accounts: a public grant must not expose the real name and dg_account of a space's accounts.
-- Public authors reach callers through my_accounts instead, under an anonymous name.
-- anon: returns no rows to anon, which has no grants of its own.
REVOKE ALL ON public.accounts_in_my_partial_spaces FROM public, anon, authenticated, service_role;
GRANT SELECT ON public.accounts_in_my_partial_spaces TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.my_pseudo_accounts AS
SELECT
    pa.id,
    pa.platform,
    pa.dg_account,
    gm.group_id,
    gm.admin,
    sa.space_id,
    sp.name,
    grpsa.permissions AS sharing_permissions
FROM public."PlatformAccount" AS pa
    JOIN public.group_membership AS gm ON (member_id = pa.dg_account)
    JOIN public.group_membership AS gm2 ON (gm2.member_id = auth.uid() AND gm2.group_id = gm.group_id)
    JOIN public."SpaceAccess" AS sa ON (sa.account_uid = pa.dg_account)
    JOIN public."Space" AS sp ON (sp.id = sa.space_id)
    LEFT OUTER JOIN public."SpaceAccess" AS grpsa ON (grpsa.account_uid = gm.group_id AND grpsa.space_id = sp.id)
WHERE pa.agent_type = 'anonymous' AND sa.permissions = 'editor';

REVOKE INSERT, UPDATE, DELETE ON public.my_pseudo_accounts FROM authenticated;
GRANT SELECT ON public.my_pseudo_accounts TO anon;


CREATE OR REPLACE FUNCTION public.accept_group_invitation(token varchar) RETURNS boolean
SET search_path = '' SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
    v_creator UUID;
    token_info JSONB;
    v_group_id UUID;
    auth_uid UUID;
    token_type varchar;
    as_admin BOOLEAN;
    is_admin BOOLEAN;
BEGIN
    BEGIN
        SELECT auth.uid() INTO STRICT auth_uid;
        IF auth_uid IS NULL THEN RETURN false; END IF;
        SELECT creator INTO v_creator STRICT FROM public.secret_token WHERE id=token;
        SELECT public.get_secret_token(token) INTO token_info STRICT;
        SELECT (token_info->>'groupId')::UUID, token_info->>'type', (token_info->'admin')::boolean INTO v_group_id, token_type, as_admin STRICT;
        IF token_type != 'groupInvitation' THEN RETURN false; END IF;
        SELECT admin INTO is_admin FROM public.group_membership WHERE member_id = v_creator AND group_id = v_group_id;
        IF is_admin IS NOT true THEN RETURN false; END IF;
        INSERT INTO public.group_membership (group_id, member_id, admin) VALUES (v_group_id, auth_uid, as_admin);
        RETURN true;
    EXCEPTION WHEN OTHERS THEN RETURN false;
    END;
END;
$$;

DROP POLICY IF EXISTS platform_account_policy ON public."PlatformAccount";

DROP POLICY IF EXISTS platform_account_select_policy ON public."PlatformAccount";
CREATE POLICY platform_account_select_policy ON public."PlatformAccount" FOR SELECT USING (dg_account = (SELECT auth.uid() LIMIT 1) OR EXISTS (SELECT 1 FROM public.accounts_in_my_partial_spaces AS v WHERE v.account_id = "PlatformAccount".id));

DROP POLICY IF EXISTS platform_account_delete_policy ON public."PlatformAccount";
CREATE POLICY platform_account_delete_policy ON public."PlatformAccount" FOR DELETE USING (dg_account = (SELECT auth.uid() LIMIT 1) OR (dg_account IS null AND EXISTS (SELECT 1 FROM public."LocalAccess" AS la WHERE la.account_id = "PlatformAccount".id AND la.space_id = any((SELECT public.my_space_ids('editor'))::bigint[]))));

DROP POLICY IF EXISTS platform_account_update_policy ON public."PlatformAccount";
CREATE POLICY platform_account_update_policy ON public."PlatformAccount" FOR UPDATE USING (dg_account = (SELECT auth.uid() LIMIT 1) OR (dg_account IS null AND EXISTS (SELECT 1 FROM public."LocalAccess" AS la WHERE la.account_id = "PlatformAccount".id AND la.space_id = any((SELECT public.my_space_ids('editor'))::bigint[]))));

-- SpaceAccess: Created through the create_account_in_space and the Space create route, both of which bypass RLS.
-- Can be updated by a space peer for now, unless claimed by a user.
-- Eventually: Allow space admin to modify?

ALTER TABLE public."SpaceAccess" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS space_access_policy ON public."SpaceAccess";

DROP POLICY IF EXISTS space_access_select_policy ON public."SpaceAccess";
CREATE POLICY space_access_select_policy ON public."SpaceAccess" FOR SELECT USING (space_id = any((SELECT public.my_space_ids('reader'))::bigint []));

DROP POLICY IF EXISTS space_access_delete_policy ON public."SpaceAccess";
CREATE POLICY space_access_delete_policy ON public."SpaceAccess" FOR DELETE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS space_access_insert_policy ON public."SpaceAccess";
CREATE POLICY space_access_insert_policy ON public."SpaceAccess" FOR INSERT WITH CHECK (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

DROP POLICY IF EXISTS space_access_update_policy ON public."SpaceAccess";
CREATE POLICY space_access_update_policy ON public."SpaceAccess" FOR UPDATE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint []));

ALTER TABLE public."LocalAccess" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS local_access_policy ON public."LocalAccess";

-- The PlatformAccount write policies read LocalAccess as the caller, so narrowing this policy narrows them too, with no error.
DROP POLICY IF EXISTS local_access_select_policy ON public."LocalAccess";
CREATE POLICY local_access_select_policy ON public."LocalAccess" FOR SELECT USING (space_id = any((SELECT public.my_space_ids('reader'))::bigint []));

DROP POLICY IF EXISTS local_access_delete_policy ON public."LocalAccess";
CREATE POLICY local_access_delete_policy ON public."LocalAccess" FOR DELETE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint[]) AND (account_id IN (SELECT account_id FROM public.account_ids_in_shared_spaces('editor') WHERE unowned) OR account_id IN (SELECT public.my_platform_account_ids())));

DROP POLICY IF EXISTS local_access_insert_policy ON public."LocalAccess";
CREATE POLICY local_access_insert_policy ON public."LocalAccess" FOR INSERT WITH CHECK (space_id = any((SELECT public.my_space_ids('editor'))::bigint[]) AND (account_id IN (SELECT account_id FROM public.account_ids_in_shared_spaces('editor') WHERE unowned) OR account_id IN (SELECT public.my_platform_account_ids())));

DROP POLICY IF EXISTS local_access_update_policy ON public."LocalAccess";
CREATE POLICY local_access_update_policy ON public."LocalAccess" FOR UPDATE USING (space_id = any((SELECT public.my_space_ids('editor'))::bigint[]) AND (account_id IN (SELECT account_id FROM public.account_ids_in_shared_spaces('editor') WHERE unowned) OR account_id IN (SELECT public.my_platform_account_ids())));

-- AgentIdentifier: Allow space members to do anything, to allow editing authors.
-- Eventually: Once the account is claimed by a user, only allow this user to modify it.

ALTER TABLE public."AgentIdentifier" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_identifier_policy ON public."AgentIdentifier";

DROP POLICY IF EXISTS agent_identifier_select_policy ON public."AgentIdentifier";
-- Identifiers hold emails, so they show only through the caller's own grants: a public grant does not count.
CREATE POLICY agent_identifier_select_policy ON public."AgentIdentifier" FOR SELECT USING (account_id IN (SELECT account_id FROM public.account_ids_in_shared_spaces('reader')));

DROP POLICY IF EXISTS agent_identifier_delete_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_delete_policy ON public."AgentIdentifier" FOR DELETE USING (account_id IN (SELECT account_id FROM public.account_ids_in_shared_spaces('editor') WHERE unowned) OR account_id IN (SELECT public.my_platform_account_ids()));

DROP POLICY IF EXISTS agent_identifier_insert_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_insert_policy ON public."AgentIdentifier" FOR INSERT WITH CHECK (account_id IN (SELECT account_id FROM public.account_ids_in_shared_spaces('editor') WHERE unowned) OR account_id IN (SELECT public.my_platform_account_ids()));

DROP POLICY IF EXISTS agent_identifier_update_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_update_policy ON public."AgentIdentifier" FOR UPDATE USING (account_id IN (SELECT account_id FROM public.account_ids_in_shared_spaces('editor') WHERE unowned) OR account_id IN (SELECT public.my_platform_account_ids()));

ALTER TABLE public.group_membership ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_membership_select_policy ON public.group_membership;
CREATE POLICY group_membership_select_policy ON public.group_membership FOR SELECT USING (public.in_group(group_id));

DROP POLICY IF EXISTS group_membership_delete_policy ON public.group_membership;
CREATE POLICY group_membership_delete_policy ON public.group_membership FOR DELETE USING (member_id = (SELECT auth.uid()) OR public.is_group_admin(group_id));

DROP POLICY IF EXISTS group_membership_insert_policy ON public.group_membership;
CREATE POLICY group_membership_insert_policy ON public.group_membership FOR INSERT WITH CHECK (public.is_group_admin(group_id));
COMMENT ON POLICY group_membership_insert_policy ON public.group_membership IS 'Only group admins add members. The create-group edge function adds the first admin with the service role, and accept_group_invitation adds invited members as a security definer.';

DROP POLICY IF EXISTS group_membership_update_policy ON public.group_membership;
CREATE POLICY group_membership_update_policy ON public.group_membership FOR UPDATE USING (public.is_group_admin(group_id));
