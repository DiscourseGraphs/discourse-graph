-- The function bypasses RLS and checked no access, and its SpaceAccess branch would grant editor to any owned account.
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

COMMENT ON FUNCTION public.upsert_account_in_space IS 'Add an account to a space the caller can edit. Grants no SpaceAccess: the space_editor and permissions fields of the input are ignored.';
COMMENT ON FUNCTION public.upsert_accounts_in_space IS 'Add accounts to a space the caller can edit, through upsert_account_in_space.';
COMMENT ON FUNCTION public.create_account_in_space IS 'Legacy wrapper of upsert_account_in_space; permissions_ is ignored.';
