CREATE OR REPLACE FUNCTION public.upsert_account_in_space(space_id_ bigint, local_account account_local_input)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
