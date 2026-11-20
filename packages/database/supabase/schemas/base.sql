SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = true;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = on;
SET default_tablespace = '';
SET default_table_access_method = heap;

COMMENT ON SCHEMA public IS 'standard public schema';


ALTER PUBLICATION supabase_realtime OWNER TO postgres;

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Default privileges on objects created in public. They replace the Supabase image's defaults, which change between versions.
-- anon gets nothing: grant each anon privilege explicitly.
-- authenticated can read and write new tables and views, so a new table must enable RLS,
-- and a new view must run as the caller or filter by the caller. See doc/security_model.md.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
-- PUBLIC gets EXECUTE on new functions by default, and anon inherits it. Only a global default, not a per-schema one, can remove it.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM public;

CREATE TYPE public."EntityType" AS ENUM (
    'Platform',
    'Space',
    'PlatformAccount',
    'Person',
    'AutomatedAgent',
    'Document',
    'Content',
    'Concept',
    'ConceptSchema',
    'ContentLink',
    'Occurrence'
);

ALTER TYPE public."EntityType" OWNER TO postgres;

COMMENT ON TYPE public."EntityType" IS 'The type of an entity';

CREATE SEQUENCE IF NOT EXISTS public.entity_id_seq
START WITH 1
INCREMENT BY 1
NO MINVALUE
NO MAXVALUE
CACHE 1;

ALTER SEQUENCE public.entity_id_seq OWNER TO "postgres";
