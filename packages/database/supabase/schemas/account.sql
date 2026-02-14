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

GRANT ALL ON TABLE public."LocalAccess" TO authenticated;
GRANT ALL ON TABLE public."LocalAccess" TO service_role;
REVOKE ALL ON TABLE public."LocalAccess" FROM anon;


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

GRANT ALL ON TABLE public."SpaceAccess" TO authenticated;
GRANT ALL ON TABLE public."SpaceAccess" TO service_role;
REVOKE ALL ON TABLE public."SpaceAccess" FROM anon;

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

REVOKE ALL ON TABLE public.group_membership FROM anon;
GRANT ALL ON TABLE public.group_membership TO authenticated;
GRANT ALL ON TABLE public.group_membership TO service_role;

CREATE OR REPLACE VIEW public.my_groups AS
SELECT id, split_part(email,'@',1) AS name FROM auth.users
    JOIN public.group_membership ON (group_id=id)
    WHERE member_id = auth.uid();

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

CREATE OR REPLACE FUNCTION public.my_permissions_in_space(
    space_id_ BIGINT
) RETURNS public."SpaceAccessPermissions"
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT permissions FROM public."SpaceAccess" WHERE space_id=space_id_ AND account_uid = auth.uid();
$$;

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
    user_uid UUID;
    permissions_ public."SpaceAccessPermissions";
BEGIN
    SELECT platform INTO STRICT platform_ FROM public."Space" WHERE id = space_id_;
    INSERT INTO public."PlatformAccount" AS pa (
            account_local_id, name, platform
        ) VALUES (
            local_account.account_local_id, local_account.name, platform_
        ) ON CONFLICT (account_local_id, platform) DO UPDATE SET
            name = COALESCE(NULLIF(TRIM(EXCLUDED.name), ''), pa.name)
        RETURNING id, dg_account INTO STRICT account_id_, user_uid;
    IF user_uid IS NOT NULL THEN
        -- is any permission specified in the input?
        permissions_ := COALESCE(
            local_account.permissions,
            CASE WHEN local_account.space_editor IS true THEN 'editor'  -- legacy
                 WHEN local_account.space_editor IS false THEN 'reader' END);
        INSERT INTO public."SpaceAccess" as sa (space_id, account_uid, permissions)
            VALUES (space_id_, user_uid, least(my_permissions_in_space(space_id_), COALESCE(permissions_, 'editor')))
            ON CONFLICT (space_id, account_uid)
            DO UPDATE SET permissions = CASE
                WHEN permissions_ IS NULL THEN permissions
                ELSE least(my_permissions_in_space(space_id_), permissions_)
                END;
    END IF;
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


CREATE OR REPLACE FUNCTION public.is_my_account(account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public."PlatformAccount"
        WHERE id = account_id AND dg_account = auth.uid()
        LIMIT 1
    );
$$;

COMMENT ON FUNCTION public.is_my_account IS 'security utility: is this my own account?';

CREATE OR REPLACE FUNCTION public.can_access_account(account_uid UUID) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT account_uid = auth.uid() OR EXISTS (
        SELECT 1 FROM public.group_membership
        WHERE member_id = auth.uid() AND group_id=account_uid
        LIMIT 1
    );
$$;

COMMENT ON FUNCTION public.can_access_account IS 'security utility: Is this my account or one of my groups?';

CREATE OR REPLACE FUNCTION public.my_user_accounts() RETURNS SETOF UUID
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT auth.uid() WHERE auth.uid() IS NOT NULL UNION
    SELECT group_id FROM public.group_membership
    WHERE member_id = auth.uid();
$$;

COMMENT ON FUNCTION public.my_user_accounts IS 'security utility: The uids which give me access, either as myself or as a group member.';

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

CREATE OR REPLACE FUNCTION public.group_exists(group_id_ UUID) RETURNS BOOLEAN
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS (SELECT true FROM public.group_membership WHERE group_id = group_id_ LIMIT 1);
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

CREATE OR REPLACE FUNCTION public.account_in_shared_space(p_account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public."LocalAccess" AS la
      JOIN public."SpaceAccess" AS sa USING (space_id)
      JOIN public.my_user_accounts() ON (sa.account_uid = my_user_accounts)
      WHERE la.account_id = p_account_id
      AND sa.permissions >= 'reader'
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
        JOIN public.my_user_accounts() ON (sa.account_uid = my_user_accounts)
        JOIN public."LocalAccess" AS la USING (space_id)
        JOIN public."PlatformAccount" AS pa ON (pa.id=la.account_id)
        WHERE la.account_id = p_account_id
          AND pa.dg_account IS NULL
          AND sa.permissions >= 'reader'
    );
$$;

COMMENT ON FUNCTION public.unowned_account_in_shared_space IS 'security utility: does current user share a space with this unowned account?';

-- Space: Allow anyone to insert, but only users who are members of the space can update or select

ALTER TABLE public."Space" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS space_policy ON public."Space";
DROP POLICY IF EXISTS space_select_policy ON public."Space";
CREATE POLICY space_select_policy ON public."Space" FOR SELECT USING (public.in_space(id, 'partial'));
DROP POLICY IF EXISTS space_delete_policy ON public."Space";
CREATE POLICY space_delete_policy ON public."Space" FOR DELETE USING (public.in_space(id, 'editor'));
DROP POLICY IF EXISTS space_update_policy ON public."Space";
CREATE POLICY space_update_policy ON public."Space" FOR UPDATE USING (public.in_space(id, 'editor'));
DROP POLICY IF EXISTS space_insert_policy ON public."Space";
CREATE POLICY space_insert_policy ON public."Space" FOR INSERT WITH CHECK (true);

CREATE OR REPLACE VIEW public.my_spaces AS
SELECT
    id,
    url,
    name,
    platform
FROM public."Space" WHERE id = any(public.my_space_ids('partial'));

-- PlatformAccount: Access to anyone sharing a space with you to create an account, to allow editing authors
-- Once the account is claimed by a user, only allow this user to modify it.
-- Eventually: Allow platform admin to modify?

ALTER TABLE public."PlatformAccount" ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW public.my_accounts AS
SELECT
    id,
    name,
    platform,
    account_local_id,
    write_permission,
    active,
    agent_type,
    metadata,
    dg_account
FROM public."PlatformAccount"
WHERE id IN (
    SELECT "LocalAccess".account_id FROM public."LocalAccess"
        JOIN public."SpaceAccess" USING (space_id)
        JOIN public.my_user_accounts() ON (account_uid = my_user_accounts)
    WHERE permissions >= 'reader'
);

DROP POLICY IF EXISTS platform_account_policy ON public."PlatformAccount";

DROP POLICY IF EXISTS platform_account_select_policy ON public."PlatformAccount";
CREATE POLICY platform_account_select_policy ON public."PlatformAccount" FOR SELECT USING (dg_account = (SELECT auth.uid() LIMIT 1) OR public.account_in_shared_space(id));

DROP POLICY IF EXISTS platform_account_delete_policy ON public."PlatformAccount";
CREATE POLICY platform_account_delete_policy ON public."PlatformAccount" FOR DELETE USING (dg_account = (SELECT auth.uid() LIMIT 1) OR (dg_account IS null AND public.unowned_account_in_shared_space(id)));

DROP POLICY IF EXISTS platform_account_insert_policy ON public."PlatformAccount";
CREATE POLICY platform_account_insert_policy ON public."PlatformAccount" FOR INSERT WITH CHECK (dg_account = (SELECT auth.uid() LIMIT 1) OR (dg_account IS null AND public.unowned_account_in_shared_space(id)));

DROP POLICY IF EXISTS platform_account_update_policy ON public."PlatformAccount";
CREATE POLICY platform_account_update_policy ON public."PlatformAccount" FOR UPDATE USING (dg_account = (SELECT auth.uid() LIMIT 1) OR (dg_account IS null AND public.unowned_account_in_shared_space(id)));

-- SpaceAccess: Created through the create_account_in_space and the Space create route, both of which bypass RLS.
-- Can be updated by a space peer for now, unless claimed by a user.
-- Eventually: Allow space admin to modify?

ALTER TABLE public."SpaceAccess" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS space_access_policy ON public."SpaceAccess";

DROP POLICY IF EXISTS space_access_select_policy ON public."SpaceAccess";
CREATE POLICY space_access_select_policy ON public."SpaceAccess" FOR SELECT USING (public.in_space(space_id));

DROP POLICY IF EXISTS space_access_delete_policy ON public."SpaceAccess";
CREATE POLICY space_access_delete_policy ON public."SpaceAccess" FOR DELETE USING (public.in_space(space_id, 'editor'));

DROP POLICY IF EXISTS space_access_insert_policy ON public."SpaceAccess";
CREATE POLICY space_access_insert_policy ON public."SpaceAccess" FOR INSERT WITH CHECK (public.in_space(space_id, 'editor'));

DROP POLICY IF EXISTS space_access_update_policy ON public."SpaceAccess";
CREATE POLICY space_access_update_policy ON public."SpaceAccess" FOR UPDATE USING (public.in_space(space_id, 'editor'));

ALTER TABLE public."LocalAccess" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS local_access_policy ON public."LocalAccess";

DROP POLICY IF EXISTS local_access_select_policy ON public."LocalAccess";
CREATE POLICY local_access_select_policy ON public."LocalAccess" FOR SELECT USING (public.in_space(space_id));

DROP POLICY IF EXISTS local_access_delete_policy ON public."LocalAccess";
CREATE POLICY local_access_delete_policy ON public."LocalAccess" FOR DELETE USING (public.unowned_account_in_shared_space(account_id) OR public.is_my_account(account_id));

DROP POLICY IF EXISTS local_access_insert_policy ON public."LocalAccess";
CREATE POLICY local_access_insert_policy ON public."LocalAccess" FOR INSERT WITH CHECK (public.unowned_account_in_shared_space(account_id) OR public.is_my_account(account_id));

DROP POLICY IF EXISTS local_access_update_policy ON public."LocalAccess";
CREATE POLICY local_access_update_policy ON public."LocalAccess" FOR UPDATE USING (public.unowned_account_in_shared_space(account_id) OR public.is_my_account(account_id));

-- AgentIdentifier: Allow space members to do anything, to allow editing authors.
-- Eventually: Once the account is claimed by a user, only allow this user to modify it.

ALTER TABLE public."AgentIdentifier" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_identifier_policy ON public."AgentIdentifier";

DROP POLICY IF EXISTS agent_identifier_select_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_select_policy ON public."AgentIdentifier" FOR SELECT USING (public.account_in_shared_space(account_id));

DROP POLICY IF EXISTS agent_identifier_delete_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_delete_policy ON public."AgentIdentifier" FOR DELETE USING (public.unowned_account_in_shared_space(account_id) OR public.is_my_account(account_id));

DROP POLICY IF EXISTS agent_identifier_insert_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_insert_policy ON public."AgentIdentifier" FOR INSERT WITH CHECK (public.unowned_account_in_shared_space(account_id) OR public.is_my_account(account_id));

DROP POLICY IF EXISTS agent_identifier_update_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_update_policy ON public."AgentIdentifier" FOR UPDATE USING (public.unowned_account_in_shared_space(account_id) OR public.is_my_account(account_id));

ALTER TABLE public.group_membership ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_membership_select_policy ON public.group_membership;
CREATE POLICY group_membership_select_policy ON public.group_membership FOR SELECT USING (public.in_group(group_id));

DROP POLICY IF EXISTS group_membership_delete_policy ON public.group_membership;
CREATE POLICY group_membership_delete_policy ON public.group_membership FOR DELETE USING (member_id = auth.uid() OR public.is_group_admin(group_id));

DROP POLICY IF EXISTS group_membership_insert_policy ON public.group_membership;
CREATE POLICY group_membership_insert_policy ON public.group_membership FOR INSERT WITH CHECK (public.is_group_admin(group_id) OR NOT public.group_exists(group_id));

DROP POLICY IF EXISTS group_membership_update_policy ON public.group_membership;
CREATE POLICY group_membership_update_policy ON public.group_membership FOR UPDATE USING (public.is_group_admin(group_id));
