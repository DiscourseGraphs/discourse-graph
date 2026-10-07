-- Single-table views are writable, and writes run as the view owner, bypassing Space's RLS.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.my_spaces FROM anon, authenticated;

-- Single-table views are writable, and writes run as the view owner, bypassing PlatformAccount's RLS.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.my_accounts FROM anon, authenticated;
