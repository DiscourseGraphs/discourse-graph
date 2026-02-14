ALTER TYPE public.account_local_input ADD ATTRIBUTE permissions public."SpaceAccessPermissions";

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
            VALUES (space_id_, user_uid, max(my_permissions_in_space(space_id_), COALESCE(permissions_, 'editor')))
            ON CONFLICT (space_id, account_uid)
            DO UPDATE SET permissions = CASE
                WHEN permissions_ IS NULL THEN permissions
                ELSE max(my_permissions_in_space(space_id_), permissions_)
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


DROP FUNCTION create_account_in_space;

CREATE OR REPLACE FUNCTION create_account_in_space(
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
