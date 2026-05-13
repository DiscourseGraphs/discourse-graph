CREATE OR REPLACE FUNCTION public.accept_group_invitation(token varchar) RETURNS boolean
SET search_path = '' SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
    v_creator UUID;
    token_info JSONB;
    v_group_id UUID;
    token_type varchar;
    as_admin BOOLEAN;
    is_admin BOOLEAN;
BEGIN
    BEGIN
        SELECT creator INTO v_creator STRICT FROM public.secret_token WHERE id=token;
        SELECT public.get_secret_token(token) INTO token_info STRICT;
        SELECT (token_info->>'groupId')::UUID, token_info->>'type', (token_info->'admin')::boolean INTO v_group_id, token_type, as_admin STRICT;
        SELECT admin INTO is_admin FROM public.group_membership WHERE member_id = v_creator AND group_id = v_group_id;
        IF is_admin IS NOT true THEN RETURN false; END IF;
        INSERT INTO public.group_membership (group_id, member_id, admin) VALUES (v_group_id, auth.uid(), as_admin);
        RETURN true;
    EXCEPTION WHEN OTHERS THEN RETURN false;
    END;
END;
$$;
