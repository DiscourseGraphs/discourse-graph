CREATE TABLE public.group_membership (
    member_id UUID NOT NULL,
    group_id UUID NOT NULL,
    admin BOOLEAN DEFAULT true
);

ALTER TABLE public.group_membership
ADD CONSTRAINT group_membership_pkey PRIMARY KEY (member_id, group_id);

CREATE INDEX IF NOT EXISTS group_membership_group_idx ON public.group_membership (group_id);

ALTER TABLE public.group_membership OWNER TO "postgres";

COMMENT ON TABLE public.group_membership IS 'A group membership table';
COMMENT ON COLUMN public.group_membership.member_id IS 'The member of the group';
COMMENT ON COLUMN public.group_membership.group_id IS 'The group identifier';

ALTER TABLE ONLY public.group_membership
ADD CONSTRAINT "group_membership_member_id_fkey" FOREIGN KEY (
    member_id
) REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.group_membership
ADD CONSTRAINT "group_membership_group_id_fkey" FOREIGN KEY (
    group_id
) REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE;


GRANT ALL ON TABLE public.group_membership TO authenticated;
GRANT ALL ON TABLE public.group_membership TO service_role;
REVOKE ALL ON TABLE public.group_membership FROM anon;

CREATE OR REPLACE FUNCTION public.in_group(group_id_ UUID) RETURNS BOOLEAN
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS (SELECT true FROM public.group_membership
        WHERE member_id = auth.uid() AND group_id = group_id_);
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(group_id_ UUID) RETURNS BOOLEAN
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS (SELECT true FROM public.group_membership
        WHERE member_id = auth.uid() AND group_id = group_id_ AND admin);
$$;

CREATE OR REPLACE FUNCTION public.group_exists(group_id_ UUID) RETURNS BOOLEAN
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS (SELECT true FROM public.group_membership WHERE group_id = group_id_ LIMIT 1);
$$;

ALTER TABLE public.group_membership ENABLE ROW LEVEL SECURITY;
CREATE POLICY group_membership_select_policy ON public.group_membership FOR SELECT USING (public.in_group(group_id));
CREATE POLICY group_membership_delete_policy ON public.group_membership FOR DELETE USING (member_id = auth.uid() OR public.is_group_admin(group_id));
CREATE POLICY group_membership_insert_policy ON public.group_membership FOR INSERT WITH CHECK (public.is_group_admin(group_id) OR NOT public.group_exists(group_id));
CREATE POLICY group_membership_update_policy ON public.group_membership FOR UPDATE WITH CHECK (public.is_group_admin(group_id));


CREATE OR REPLACE FUNCTION public.my_user_accounts() RETURNS SETOF UUID
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT auth.uid() WHERE auth.uid() IS NOT NULL UNION
    SELECT group_id FROM public.group_membership
    WHERE member_id = auth.uid();
$$;

COMMENT ON FUNCTION public.my_user_accounts IS 'security utility: The uids which give me access, either as myself or as a group member.';

CREATE OR REPLACE FUNCTION public.my_space_ids() RETURNS BIGINT []
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT COALESCE(array_agg(distinct space_id), '{}') AS ids
        FROM public."SpaceAccess"
        JOIN public.my_user_accounts() ON (account_uid = my_user_accounts);
$$;

CREATE OR REPLACE FUNCTION public.in_space(space_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS (SELECT 1 FROM public."SpaceAccess" AS sa
        JOIN public.my_user_accounts() ON (sa.account_uid = my_user_accounts)
        WHERE sa.space_id = in_space.space_id);
$$;

CREATE OR REPLACE FUNCTION public.account_in_shared_space(p_account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public."LocalAccess" AS la
      JOIN public."SpaceAccess" AS sa USING (space_id)
      JOIN public.my_user_accounts() ON (sa.account_uid = my_user_accounts)
      WHERE la.account_id = p_account_id
    );
$$;

CREATE OR REPLACE FUNCTION public.unowned_account_in_shared_space(p_account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public."SpaceAccess" AS sa
        JOIN public.my_user_accounts() ON (sa.account_uid = my_user_accounts)
        JOIN public."LocalAccess" AS la USING (space_id)
        JOIN public."PlatformAccount" AS pa ON (pa.id=la.account_id)
        WHERE la.account_id = p_account_id
          AND pa.dg_account IS NULL
    );
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
        JOIN public.my_user_accounts() ON (account_uid = my_user_accounts)
);
