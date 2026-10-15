-- CREATE OR REPLACE VIEW cannot drop columns, and both functions return the view's row type.
DROP FUNCTION public.author_of_content(public.my_contents);
DROP FUNCTION public.author_of_concept(public.my_concepts);
DROP VIEW public.my_accounts;

-- Leaves out dg_account and metadata: peers have no use for them, and a known auth uid should not be handed out.
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
