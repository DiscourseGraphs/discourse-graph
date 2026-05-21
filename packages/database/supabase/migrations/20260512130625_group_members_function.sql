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
    pa.id,
    pa.platform,
    pa.dg_account,
    sa.space_id,
    sp.name,
    mysa.space_id IS NOT NULL AS shared
FROM public."PlatformAccount" AS pa
    JOIN public.group_membership AS gm ON (member_id = dg_account)
    JOIN public.group_membership AS gm2 ON (gm2.member_id = auth.uid() AND gm2.group_id = gm.group_id)
    JOIN public."SpaceAccess" AS sa ON (sa.account_uid = dg_account)
    JOIN public."Space" AS sp ON (sp.id = sa.space_id)
    LEFT OUTER JOIN public."SpaceAccess" AS mysa ON (mysa.account_uid = gm.group_id AND mysa.space_id = sp.id)
WHERE pa.agent_type = 'anonymous' AND sa.permissions = 'editor';

CREATE TYPE public.group_space_info AS (
    id BIGINT,
    name VARCHAR,
    platform public."Platform",
    shared boolean,
    admin boolean
);

CREATE OR REPLACE FUNCTION public.spaces_in_group(p_group_id UUID) RETURNS SETOF public.group_space_info
STABLE
SET search_path = ''
LANGUAGE sql AS $$
    SELECT pa.space_id as id, pa.name, pa.platform, pa.shared, gm.admin
    FROM public.my_pseudo_accounts AS pa
    JOIN public.group_membership AS gm ON (gm.member_id = pa.dg_account)
    WHERE gm.group_id = p_group_id;
$$;
