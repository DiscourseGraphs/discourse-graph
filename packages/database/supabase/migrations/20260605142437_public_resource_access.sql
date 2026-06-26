CREATE OR REPLACE FUNCTION public.my_user_accounts() RETURNS SETOF UUID
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT auth.uid() WHERE auth.uid() IS NOT NULL UNION
    SELECT '00000000-0000-0000-0000-000000000000'::uuid UNION
    SELECT group_id FROM public.group_membership
    WHERE member_id = auth.uid();
$$;


GRANT SELECT ON TABLE public."ResourceAccess" TO anon;
GRANT SELECT ON TABLE public."Document" TO anon;
GRANT SELECT ON TABLE public."Content" TO anon;
GRANT SELECT ON TABLE public."Concept" TO anon;

INSERT INTO auth.users (instance_id, id, aud, role, created_at, updated_at, is_super_admin, is_anonymous)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'anon', 'anon', now(), now(), false, true);
