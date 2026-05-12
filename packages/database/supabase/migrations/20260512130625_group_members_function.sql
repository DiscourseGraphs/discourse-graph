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
    WHERE permissions >= 'partial'
    UNION
    SELECT id FROM public."PlatformAccount" WHERE dg_account = auth.uid()
);

CREATE OR REPLACE VIEW public.my_pseudo_accounts AS
SELECT
    id,
    platform,
    dg_account,
    space_id
FROM public."PlatformAccount"
    JOIN public.group_membership AS gm ON (member_id = dg_account)
    JOIN public.group_membership AS gm2 ON (gm2.member_id = auth.uid() AND gm2.group_id = gm.group_id)
    JOIN public."SpaceAccess" AS sa ON (sa.account_uid = dg_account)
WHERE agent_type = 'anonymous' AND permissions = 'editor';

CREATE TYPE public.group_space_info AS (
    id BIGINT,
    name VARCHAR,
    platform public."Platform",
    admin boolean
);

CREATE OR REPLACE FUNCTION public.spaces_in_group(p_group_id UUID) RETURNS SETOF public.group_space_info
STABLE
SET search_path = ''
LANGUAGE sql AS $$
    SELECT sp.id, sp.name, sp.platform, gm.admin FROM public."Space" AS sp
    JOIN public.my_pseudo_accounts AS pa ON (sp.id = pa.space_id)
    JOIN public.group_membership AS gm ON (gm.member_id = pa.dg_account)
    JOIN public.group_membership AS gm2 ON (gm2.group_id = gm.group_id)
    AND gm.group_id = p_group_id AND gm2.member_id = auth.uid();
$$;
