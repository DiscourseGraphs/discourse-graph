DROP VIEW public.my_pseudo_accounts;

CREATE VIEW public.my_pseudo_accounts AS
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
    LEFT OUTER JOIN public."SpaceAccess" AS grpsa ON (grpsa.account_uid = gm.group_id AND grpsa.space_id = sp.id);

DROP FUNCTION public.spaces_in_group;

DROP TYPE public.group_space_info;
