CREATE OR REPLACE FUNCTION public.schema_of_concept(concept public."Concept")
RETURNS SETOF public."Concept" STABLE
ROWS 1
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public."Concept" WHERE id=concept.schema_id;
$$;

CREATE OR REPLACE FUNCTION public.instances_of_schema(schema public."Concept")
RETURNS SETOF public."Concept" STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public."Concept" WHERE schema_id=schema.id;
$$;
