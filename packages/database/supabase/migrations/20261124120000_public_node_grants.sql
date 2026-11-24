-- Reserved account for explicit public node grants. No client signs in as this account.
INSERT INTO auth.users (instance_id, id, aud, role, created_at, updated_at, is_anonymous)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'anon', 'anon', now(), now(), true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public."SpaceAccess" ADD CONSTRAINT "SpaceAccess_everyone_partial_only" CHECK (
    account_uid <> '00000000-0000-0000-0000-000000000000' OR permissions = 'partial'
);

-- Read the pair of public grants as owner so the caller needs no access to space membership.
CREATE OR REPLACE FUNCTION public.public_node_grants() RETURNS SETOF public.accessible_resource
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT ra.space_id, ra.source_local_id
    FROM public."ResourceAccess" AS ra
    JOIN public."SpaceAccess" AS sa USING (space_id, account_uid)
    WHERE ra.account_uid = '00000000-0000-0000-0000-000000000000' AND sa.permissions = 'partial';
$$;

REVOKE EXECUTE ON FUNCTION public.public_node_grants FROM public;
GRANT EXECUTE ON FUNCTION public.public_node_grants TO anon, authenticated, service_role;

-- The existing node SELECT policies also read ResourceAccess as the caller under RLS.
GRANT SELECT ON TABLE public."ResourceAccess" TO anon;

CREATE POLICY public_node_space_select ON public."Space" FOR SELECT TO anon, authenticated USING (
    id IN (SELECT space_id FROM public.public_node_grants())
);

GRANT SELECT ON TABLE public."Content" TO anon;

CREATE POLICY public_node_content_select ON public."Content" FOR SELECT TO anon, authenticated USING (
    (space_id, source_local_id) IN (SELECT space_id, source_local_id FROM public.public_node_grants())
);

GRANT SELECT ON TABLE public."Concept" TO anon;

CREATE POLICY public_node_concept_select ON public."Concept" FOR SELECT TO anon, authenticated USING (
    (space_id, source_local_id) IN (SELECT space_id, source_local_id FROM public.public_node_grants())
);
