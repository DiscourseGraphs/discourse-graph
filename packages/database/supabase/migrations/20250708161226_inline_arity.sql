
set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.compute_arity_local(schema_id bigint, lit_content jsonb)
 RETURNS smallint
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE WHEN schema_id IS NULL THEN (
    SELECT COALESCE(jsonb_array_length(lit_content->'roles'), 0)
  ) ELSE (
    SELECT COALESCE(jsonb_array_length(literal_content->'roles'), 0) FROM public."Concept" WHERE id=compute_arity_local.schema_id
  ) END;
$function$
;

drop function if exists public.compute_arity_id(p_schema_id bigint);

drop function if exists public.compute_arity_lit(lit_content jsonb);
