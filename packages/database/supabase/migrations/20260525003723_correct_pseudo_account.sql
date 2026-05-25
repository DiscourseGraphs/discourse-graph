CREATE OR REPLACE VIEW public.my_pseudo_accounts AS
SELECT
    pa.id,
    pa.platform,
    pa.dg_account,
    sa.space_id,
    sp.name,
    max(mysa.permissions) AS sharing_permissions
FROM public."PlatformAccount" AS pa
    JOIN public.group_membership AS gm ON (member_id = dg_account)
    JOIN public.group_membership AS gm2 ON (gm2.member_id = auth.uid() AND gm2.group_id = gm.group_id)
    JOIN public."SpaceAccess" AS sa ON (sa.account_uid = dg_account)
    JOIN public."Space" AS sp ON (sp.id = sa.space_id)
    LEFT OUTER JOIN public."SpaceAccess" AS mysa ON (mysa.account_uid = gm.group_id AND mysa.space_id = sp.id)
WHERE pa.agent_type = 'anonymous' AND sa.permissions = 'editor'
GROUP BY
    pa.id,
    pa.platform,
    pa.dg_account,
    sa.space_id,
    sp.name;
