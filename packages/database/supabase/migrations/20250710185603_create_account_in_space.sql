CREATE OR REPLACE FUNCTION public.create_account_in_space(
    space_id_ BIGINT,
    account_local_id_ varchar,
    name_ varchar,
    email_ varchar = NULL,
    email_trusted boolean = true,
    editor_ boolean = true
) RETURNS BIGINT
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql  AS $$
DECLARE
    platform_ public."Platform";
    account_id_ BIGINT;
BEGIN
    SELECT platform INTO platform_ STRICT FROM public."Space" WHERE id = space_id_;
    INSERT INTO public."PlatformAccount" AS pa (
            account_local_id, name, platform
        ) VALUES (
            account_local_id_, name_, platform_
        ) ON CONFLICT (account_local_id, platform) DO UPDATE SET
            name = coalesce(name_, pa.name)
        RETURNING id INTO STRICT account_id_;
    INSERT INTO public."SpaceAccess" (space_id, account_id, editor) values (space_id_, account_id_, editor_)
        ON CONFLICT (space_id, account_id)
        DO UPDATE SET editor = editor_;
    IF email_ IS NOT NULL THEN
        INSERT INTO public."AgentIdentifier" (account_id, value, identifier_type, trusted) VALUES (account_id_, email_, 'email', email_trusted)
         ON CONFLICT (value, identifier_type, account_id)
         DO UPDATE SET trusted = email_trusted;
    END IF;
    RETURN account_id_;
END;
$$;
