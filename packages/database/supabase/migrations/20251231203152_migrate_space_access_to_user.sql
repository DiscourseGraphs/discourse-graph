REVOKE ALL ON TABLE public."SpaceAccess" FROM anon;
DROP POLICY IF EXISTS space_access_select_policy ON public."SpaceAccess";
DROP POLICY IF EXISTS space_access_delete_policy ON public."SpaceAccess";
DROP POLICY IF EXISTS space_access_insert_policy ON public."SpaceAccess";
DROP POLICY IF EXISTS space_access_update_policy ON public."SpaceAccess";
ALTER TABLE ONLY public."SpaceAccess" DROP CONSTRAINT "SpaceAccess_pkey";

ALTER TABLE public."SpaceAccess" RENAME TO "LocalAccess";

COMMENT ON TABLE public."LocalAccess" IS 'A record of which platform accounts have used this space';

COMMENT ON COLUMN public."LocalAccess".account_id IS 'The identity of the local account in this space';

ALTER TABLE ONLY public."LocalAccess"
RENAME CONSTRAINT "SpaceAccess_account_id_fkey" TO "LocalAccess_account_id_fkey";

ALTER TABLE ONLY public."LocalAccess"
RENAME CONSTRAINT "SpaceAccess_space_id_fkey" TO "LocalAccess_space_id_fkey";

ALTER TABLE public."LocalAccess" ADD CONSTRAINT "LocalAccess_pkey" PRIMARY KEY (account_id, space_id);


CREATE TABLE IF NOT EXISTS public."SpaceAccess" (
    account_uid UUID NOT NULL,
    space_id bigint NOT NULL,
    editor boolean NOT NULL
);

ALTER TABLE ONLY public."SpaceAccess"
ADD CONSTRAINT "SpaceAccess_pkey" PRIMARY KEY (account_uid, space_id);

ALTER TABLE public."SpaceAccess" OWNER TO "postgres";

COMMENT ON TABLE public."SpaceAccess" IS 'An access control entry for a space';

COMMENT ON COLUMN public."SpaceAccess".space_id IS 'The space in which the content is located';

COMMENT ON COLUMN public."SpaceAccess".account_uid IS 'The identity of the user account';

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

INSERT INTO public."SpaceAccess"
SELECT pa.dg_account, la.space_id, la.editor
FROM public."LocalAccess" AS la
    JOIN public."PlatformAccount" AS pa ON (pa.id = la.account_id)
WHERE pa.dg_account IS NOT NULL;

ALTER TABLE public."LocalAccess" DROP COLUMN editor;
DELETE FROM public."LocalAccess" WHERE account_id IN (
    SELECT id FROM public."PlatformAccount"
    WHERE agent_type = 'anonymous'
);

CREATE OR REPLACE FUNCTION public.is_my_account(account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT COUNT(id) > 0 FROM public."PlatformAccount"
    WHERE id = account_id AND dg_account = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.my_space_ids() RETURNS BIGINT []
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT COALESCE(array_agg(distinct space_id), '{}') AS ids
        FROM public."SpaceAccess"
        WHERE account_uid = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.in_space(space_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS (SELECT 1 FROM public."SpaceAccess" AS sa
        WHERE sa.space_id = in_space.space_id
        AND sa.account_uid=auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.account_in_shared_space(p_account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public."LocalAccess" AS la
      JOIN public."SpaceAccess" AS sa USING (space_id)
      WHERE la.account_id = p_account_id
        AND sa.account_uid = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.unowned_account_in_shared_space(p_account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public."SpaceAccess" AS sa
        JOIN public."LocalAccess" AS la USING (space_id)
        JOIN public."PlatformAccount" AS pa ON (pa.id=la.account_id)
        WHERE la.account_id = p_account_id
          AND sa.account_uid = auth.uid()
          AND pa.dg_account IS NULL
    );
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
    user_uuid VARCHAR;
BEGIN
    SELECT platform INTO STRICT platform_ FROM public."Space" WHERE id = space_id_;
    INSERT INTO public."PlatformAccount" AS pa (
            account_local_id, name, platform
        ) VALUES (
            local_account.account_local_id, local_account.name, platform_
        ) ON CONFLICT (account_local_id, platform) DO UPDATE SET
            name = COALESCE(NULLIF(TRIM(EXCLUDED.name), ''), pa.name)
        RETURNING id, dg_account INTO STRICT account_id_, user_uuid;
    IF user_uuid IS NOT NULL THEN
        INSERT INTO public."SpaceAccess" as sa (space_id, account_uid, editor)
            VALUES (space_id_, user_uuid, COALESCE(local_account.space_editor, true))
            ON CONFLICT (space_id, account_uid)
            DO UPDATE SET editor = COALESCE(local_account.space_editor, sa.editor, true);
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
    WHERE "SpaceAccess".account_uid = auth.uid()
);

ALTER TABLE public."SpaceAccess" ENABLE ROW LEVEL SECURITY;

CREATE POLICY space_access_select_policy ON public."SpaceAccess" FOR SELECT USING (public.in_space(space_id));
CREATE POLICY space_access_delete_policy ON public."SpaceAccess" FOR DELETE USING (account_uid = auth.uid());
CREATE POLICY space_access_insert_policy ON public."SpaceAccess" FOR INSERT WITH CHECK (account_uid = auth.uid());
CREATE POLICY space_access_update_policy ON public."SpaceAccess" FOR UPDATE WITH CHECK (account_uid = auth.uid());

CREATE POLICY local_access_select_policy ON public."LocalAccess" FOR SELECT USING (public.in_space(space_id));
CREATE POLICY local_access_delete_policy ON public."LocalAccess" FOR DELETE USING (public.unowned_account_in_shared_space(account_id) OR public.is_my_account(account_id));
CREATE POLICY local_access_insert_policy ON public."LocalAccess" FOR INSERT WITH CHECK (public.unowned_account_in_shared_space(account_id) OR public.is_my_account(account_id));
CREATE POLICY local_access_update_policy ON public."LocalAccess" FOR UPDATE WITH CHECK (public.unowned_account_in_shared_space(account_id) OR public.is_my_account(account_id));

DROP POLICY IF EXISTS agent_identifier_delete_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_delete_policy ON public."AgentIdentifier" FOR DELETE USING (public.unowned_account_in_shared_space(account_id) OR public.is_my_account(account_id));

DROP POLICY IF EXISTS agent_identifier_insert_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_insert_policy ON public."AgentIdentifier" FOR INSERT WITH CHECK (public.unowned_account_in_shared_space(account_id) OR public.is_my_account(account_id));

DROP POLICY IF EXISTS agent_identifier_update_policy ON public."AgentIdentifier";
CREATE POLICY agent_identifier_update_policy ON public."AgentIdentifier" FOR UPDATE WITH CHECK (public.unowned_account_in_shared_space(account_id) OR public.is_my_account(account_id));

DROP FUNCTION public.my_account();
