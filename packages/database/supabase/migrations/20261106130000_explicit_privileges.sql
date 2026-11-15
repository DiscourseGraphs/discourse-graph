-- Privileges must not depend on the Supabase image: its default privileges for postgres in public changed in 17.11.0.018.

-- Defaults for objects that later migrations create in public.
-- anon gets nothing: every anon privilege is granted explicitly.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;

-- Bring existing objects to the same defaults, whatever image built them. The exceptions follow.
-- REVOKE ALL on a table also removes its column grants, so PlatformAccount's are granted again below.
DO $$
DECLARE
    rel record;
    fn regprocedure;
BEGIN
    FOR rel IN
        SELECT c.oid::regclass AS name, c.relkind
        FROM pg_catalog.pg_class AS c
        WHERE c.relnamespace = 'public'::regnamespace
        AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
        AND c.relowner = 'postgres'::regrole
        AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_depend AS d
            WHERE d.classid = 'pg_catalog.pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
        )
    LOOP
        IF rel.relkind = 'S' THEN
            EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated, service_role', rel.name);
            EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO authenticated', rel.name);
            EXECUTE format('GRANT ALL ON SEQUENCE %s TO service_role', rel.name);
        ELSE
            EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated, service_role', rel.name);
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO authenticated', rel.name);
            EXECUTE format('GRANT ALL ON TABLE %s TO service_role', rel.name);
        END IF;
    END LOOP;
    FOR fn IN
        SELECT p.oid::regprocedure
        FROM pg_catalog.pg_proc AS p
        WHERE p.pronamespace = 'public'::regnamespace
        AND p.proowner = 'postgres'::regrole
        AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_depend AS d
            WHERE d.classid = 'pg_catalog.pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
        )
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
    END LOOP;
END;
$$;

-- Made ahead of public access, when clients without a login will read what is shared publicly. RLS decides which rows they see.
-- Space's policy shows anon no rows today. create-space runs a test query on Space with the caller's key, and refuses the call if it fails.
GRANT SELECT ON TABLE
public."Space",
public.concept_contributors,
public.content_contributors,
public.accounts_in_my_partial_spaces,
public.my_accounts,
public.my_concepts,
public.my_contents,
public.my_contents_with_embedding_openai_text_embedding_3_small_1536,
public.my_documents,
public.my_file_references,
public.my_groups,
public.my_pseudo_accounts,
public.my_resource_grants,
public.my_spaces
TO anon;

-- Clients read the views and never write through them.
REVOKE INSERT, UPDATE, DELETE ON TABLE
public.accounts_in_my_partial_spaces,
public.my_accounts,
public.my_concepts,
public.my_contents,
public.my_contents_with_embedding_openai_text_embedding_3_small_1536,
public.my_documents,
public.my_file_references,
public.my_groups,
public.my_pseudo_accounts,
public.my_resource_grants,
public.my_spaces
FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE
public.accounts_in_my_partial_spaces,
public.my_resource_grants
FROM service_role;

-- Only create-space creates spaces: it writes Space and SpaceAccess together with the service key.
-- A Space row inserted directly has no SpaceAccess, so nobody can see it, and it takes its url.
REVOKE INSERT ON TABLE public."Space" FROM authenticated;
-- Without the privilege, this policy is unreachable. Dropping it keeps a future grant from reopening direct inserts.
DROP POLICY IF EXISTS space_insert_policy ON public."Space";

-- Clients cannot read or set who owns an account, or change what identifies it. See account.sql.
REVOKE SELECT, INSERT, UPDATE ON TABLE public."PlatformAccount" FROM authenticated;
GRANT SELECT (id, name, platform, account_local_id, write_permission, active, agent_type) ON TABLE public."PlatformAccount" TO authenticated;
GRANT UPDATE (name, active) ON TABLE public."PlatformAccount" TO authenticated;

-- Only the service key and triggers use file_gc.
REVOKE ALL ON TABLE public.file_gc FROM authenticated;

-- Only triggers call these. Postgres checks EXECUTE on a trigger function when the trigger is created, not when it fires.
REVOKE ALL ON FUNCTION public.after_delete_space() FROM authenticated;
REVOKE ALL ON FUNCTION public.after_delete_update_fref() FROM authenticated;
REVOKE ALL ON FUNCTION public.after_insert_fref() FROM authenticated;
REVOKE ALL ON FUNCTION public.concept_propagate_derived_columns() FROM authenticated;
REVOKE ALL ON FUNCTION public.concept_set_derived_columns() FROM authenticated;
REVOKE ALL ON FUNCTION public.is_last_local_reference(bigint, varchar) FROM authenticated;
REVOKE ALL ON FUNCTION public.on_delete_local_reference() FROM authenticated;
REVOKE ALL ON FUNCTION public.on_delete_space_revoke_local_access() FROM authenticated;
REVOKE ALL ON FUNCTION public.on_update_local_reference() FROM authenticated;

-- Functions that clients without a login call, directly or through policies and views. None of them writes,
-- except get_secret_token, which the website's token handoff calls before the browser has a session.
GRANT EXECUTE ON FUNCTION public._local_concept_to_db_concept(public.concept_local_input) TO anon;
GRANT EXECUTE ON FUNCTION public._local_content_to_db_content(public.content_local_input) TO anon;
GRANT EXECUTE ON FUNCTION public._local_document_to_db_document(public.document_local_input) TO anon;
GRANT EXECUTE ON FUNCTION public.author_of_concept(public.my_concepts) TO anon;
GRANT EXECUTE ON FUNCTION public.author_of_content(public.my_contents) TO anon;
GRANT EXECUTE ON FUNCTION public.compute_arity_local(bigint, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.compute_is_relation_local(bigint, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.concept_in_relations(public."Concept") TO anon;
GRANT EXECUTE ON FUNCTION public.concept_in_relations(public.my_concepts) TO anon;
GRANT EXECUTE ON FUNCTION public.concept_in_space(bigint, public."SpaceAccessPermissions") TO anon;
GRANT EXECUTE ON FUNCTION public.concepts_of_relation(public."Concept") TO anon;
GRANT EXECUTE ON FUNCTION public.concepts_of_relation(public.my_concepts) TO anon;
GRANT EXECUTE ON FUNCTION public.content_in_space(bigint, public."SpaceAccessPermissions") TO anon;
GRANT EXECUTE ON FUNCTION public.content_of_concept(public.my_concepts) TO anon;
GRANT EXECUTE ON FUNCTION public.document_in_space(bigint, public."SpaceAccessPermissions") TO anon;
GRANT EXECUTE ON FUNCTION public.document_of_content(public.my_contents) TO anon;
GRANT EXECUTE ON FUNCTION public.extract_references(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.file_access(varchar) TO anon;
GRANT EXECUTE ON FUNCTION public.get_secret_token(varchar) TO anon;
GRANT EXECUTE ON FUNCTION public.get_space_anonymous_email(public."Platform", bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.instances_of_schema(public."Concept") TO anon;
GRANT EXECUTE ON FUNCTION public.instances_of_schema(public.my_concepts) TO anon;
GRANT EXECUTE ON FUNCTION public.match_content_embeddings(extensions.vector, double precision, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.match_embeddings_for_subset_nodes(extensions.vector, text []) TO anon;
GRANT EXECUTE ON FUNCTION public.my_accessible_resources() TO anon;
GRANT EXECUTE ON FUNCTION public.my_permissions_in_space(bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.my_space_ids(public."SpaceAccessPermissions") TO anon;
GRANT EXECUTE ON FUNCTION public.my_user_accounts() TO anon;
GRANT EXECUTE ON FUNCTION public.rid_or_local_id_to_concept_db_id(varchar, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.rid_to_space_id_and_local_id(varchar) TO anon;
GRANT EXECUTE ON FUNCTION public.schema_of_concept(public."Concept") TO anon;
GRANT EXECUTE ON FUNCTION public.schema_of_concept(public.my_concepts) TO anon;
