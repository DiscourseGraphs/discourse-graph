-- CREATE OR REPLACE VIEW cannot drop columns, and both functions return the view's row type.
DROP FUNCTION public.author_of_content(public.my_contents);
DROP FUNCTION public.author_of_concept(public.my_concepts);
DROP VIEW public.my_accounts;

-- Leaves out dg_account, which would show which accounts belong to one person, and metadata, which nothing uses yet.
CREATE VIEW public.my_accounts AS
SELECT
    id,
    name,
    platform,
    account_local_id,
    write_permission,
    active,
    agent_type
FROM public."PlatformAccount"
WHERE id IN (
    SELECT "LocalAccess".account_id FROM public."LocalAccess"
        JOIN public."SpaceAccess" USING (space_id)
        JOIN public.my_user_accounts() ON (account_uid = my_user_accounts)
    WHERE permissions >= 'partial'
    UNION
    SELECT id FROM public."PlatformAccount" WHERE dg_account = auth.uid()
);

-- Single-table views are writable, and writes run as the view owner, bypassing PlatformAccount's RLS.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.my_accounts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.author_of_content(content public.my_contents)
RETURNS SETOF public.my_accounts STRICT STABLE
ROWS 1
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_accounts WHERE id=content.author_id;
$$;
COMMENT ON FUNCTION public.author_of_content(public.my_contents)
IS 'Computed one-to-one: returns the PlatformAccount which authored a given Content.';
GRANT EXECUTE ON FUNCTION public.author_of_content(public.my_contents) TO anon;

CREATE OR REPLACE FUNCTION public.author_of_concept(concept public.my_concepts)
RETURNS SETOF public.my_accounts STRICT STABLE
ROWS 1
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public.my_accounts WHERE id=concept.author_id;
$$;
COMMENT ON FUNCTION public.author_of_concept(public.my_concepts)
IS 'Computed one-to-one: returns the PlatformAccount which authored a given Concept.';
GRANT EXECUTE ON FUNCTION public.author_of_concept(public.my_concepts) TO anon;

-- Clients cannot read dg_account, which would show which accounts belong to one person, or metadata, which nothing uses yet.
-- Reads and updates are granted per column: a new column is hidden from clients until it is added to these grants.
REVOKE SELECT ON TABLE public."PlatformAccount" FROM authenticated;
GRANT SELECT (id, name, platform, account_local_id, write_permission, active, agent_type) ON TABLE public."PlatformAccount" TO authenticated;
REVOKE UPDATE (metadata) ON TABLE public."PlatformAccount" FROM authenticated;
