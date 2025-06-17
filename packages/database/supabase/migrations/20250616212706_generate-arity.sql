CREATE OR REPLACE FUNCTION public.compute_arity_id(p_schema_id bigint)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT COALESCE(jsonb_array_length(literal_content->'roles'), 0) FROM public."Concept" WHERE id=p_schema_id;
$function$;

CREATE OR REPLACE FUNCTION public.compute_arity_lit(lit_content jsonb)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT COALESCE(jsonb_array_length(lit_content->'roles'), 0);
$function$;

CREATE OR REPLACE FUNCTION public.compute_arity_local(schema_id bigint, lit_content jsonb)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE WHEN schema_id IS NULL THEN compute_arity_lit(lit_content) ELSE compute_arity_id(schema_id) END;
$function$;

ALTER TABLE "public"."Concept" DROP COLUMN "arity";

ALTER TABLE "public"."Concept" ADD COLUMN "arity" smallint GENERATED ALWAYS AS (compute_arity_local(schema_id, literal_content)) STORED;

CREATE OR REPLACE FUNCTION public.extract_references(refs jsonb)
RETURNS bigint []
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT COALESCE(array_agg(i::bigint), '{}') FROM (SELECT DISTINCT jsonb_array_elements(jsonb_path_query_array(refs, '$.*[*]')) i) exrefs;
$function$;
