-- New functions are not executable without a login. Grant anon explicitly where a client or policy needs it.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
-- PUBLIC gets EXECUTE on new functions by default, and anon inherits it. Only a global default, not a per-schema one, can remove it.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM public;

-- Every role that calls our functions holds its own grant, so PUBLIC's grant only matters for anon.
-- Removing it makes existing functions match the ones created under the defaults above.
DO $$
DECLARE
    fn regprocedure;
BEGIN
    FOR fn IN
        SELECT p.oid::regprocedure FROM pg_catalog.pg_proc AS p
        WHERE p.pronamespace = 'public'::regnamespace
        AND p.proowner = 'postgres'::regrole
        AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_depend AS d
            WHERE d.classid = 'pg_catalog.pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
        )
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
    END LOOP;
END;
$$;

-- Only triggers call these. Postgres checks EXECUTE on a trigger function when the trigger is created, not when it fires.
REVOKE ALL ON FUNCTION public.after_delete_space() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.after_delete_update_fref() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.after_insert_fref() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.on_delete_local_reference() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.on_update_local_reference() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.on_delete_space_revoke_local_access() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.concept_set_derived_columns() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.concept_propagate_derived_columns() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_last_local_reference(bigint, varchar) FROM anon, authenticated;

-- Nothing calls these without a login.
REVOKE ALL ON FUNCTION public.create_account_in_space(bigint, varchar, varchar, varchar, boolean, public."SpaceAccessPermissions") FROM anon;
REVOKE ALL ON FUNCTION public.upsert_account_in_space(bigint, public.account_local_input) FROM anon;
REVOKE ALL ON FUNCTION public.upsert_accounts_in_space(bigint, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.file_exists(varchar) FROM anon;
REVOKE ALL ON FUNCTION public.create_secret_token(jsonb, boolean, interval) FROM anon;
REVOKE ALL ON FUNCTION public.accept_group_invitation(varchar) FROM anon;
REVOKE ALL ON FUNCTION public.generic_entity_access(bigint, public."EntityType") FROM anon;
REVOKE ALL ON FUNCTION public.in_group(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_group_admin(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.in_space(bigint, public."SpaceAccessPermissions") FROM anon;

-- group_exists may already be dropped.
DO $$
BEGIN
    IF to_regprocedure('public.group_exists(uuid)') IS NOT NULL THEN
        REVOKE ALL ON FUNCTION public.group_exists(uuid) FROM anon;
    END IF;
END;
$$;

-- The sync_info policy calls generic_entity_access, and the plugins log in before syncing.
REVOKE ALL ON TABLE public.sync_info FROM anon;
REVOKE ALL ON SEQUENCE public.sync_info_id_seq FROM anon;

-- anon can't write: the write policies call in_space through concept_in_space and content_in_space, and anon can't execute it.
-- SELECT stays for public access, which also needs SELECT on the parent tables and on ResourceAccess.
REVOKE ALL ON TABLE public.concept_contributors FROM anon;
GRANT SELECT ON TABLE public.concept_contributors TO anon;
REVOKE ALL ON TABLE public.content_contributors FROM anon;
GRANT SELECT ON TABLE public.content_contributors TO anon;

ALTER POLICY group_membership_delete_policy ON public.group_membership USING (member_id = (SELECT auth.uid()) OR public.is_group_admin(group_id));
ALTER POLICY concept_select_policy ON public.secret_token USING (creator = (SELECT auth.uid()));
ALTER POLICY concept_delete_policy ON public.secret_token USING (creator = (SELECT auth.uid()));
ALTER POLICY concept_update_policy ON public.secret_token USING (creator = (SELECT auth.uid()));
