-- These are things which are not handled by drizzle but are needed to apply the drizzle generated sql

CREATE EXTENSION IF NOT EXISTS vector with schema extensions;
CREATE EXTENSION IF NOT EXISTS pgroonga WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_jsonschema WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_monitor WITH SCHEMA extensions;

-- empty function skeletons for generated columns and RLS policies
-- functions bodies defined in functions.sql

CREATE OR REPLACE FUNCTION public.extract_references(refs JSONB)
RETURNS BIGINT [] IMMUTABLE
SET search_path = ''
LANGUAGE sql
AS $$
  SELECT ARRAY[]::BIGINT[];
$$;

CREATE OR REPLACE FUNCTION public.compute_arity_local(schema_id BIGINT, lit_content JSONB)
RETURNS smallint IMMUTABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT 0;
$$;

CREATE TYPE "public"."EntityType" AS ENUM('Platform', 'Space', 'PlatformAccount', 'Person', 'AutomatedAgent', 'Document', 'Content', 'Concept', 'ConceptSchema', 'ContentLink', 'Occurrence');
CREATE OR REPLACE FUNCTION public.is_my_account(account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT false;
$$;



CREATE OR REPLACE FUNCTION public.my_account() RETURNS BIGINT
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT 0;
$$;



CREATE OR REPLACE FUNCTION public.my_space_ids() RETURNS BIGINT []
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT ARRAY[]::BIGINT[];
$$;



CREATE OR REPLACE FUNCTION public.in_space(space_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT false;
$$;


CREATE OR REPLACE FUNCTION public.account_in_shared_space(p_account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT false;
$$;


CREATE OR REPLACE FUNCTION public.unowned_account_in_shared_space(p_account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT false;
$$;

CREATE OR REPLACE FUNCTION public.concept_in_space(concept_id BIGINT) RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT false;
$$;


CREATE OR REPLACE FUNCTION public.content_in_space(content_id BIGINT) RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT false;
$$;

CREATE OR REPLACE FUNCTION public.document_in_space(document_id BIGINT) RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT false;
$$;

CREATE OR REPLACE FUNCTION public.generic_entity_access(target_id BIGINT, target_type public."EntityType") RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT false;
$$;
