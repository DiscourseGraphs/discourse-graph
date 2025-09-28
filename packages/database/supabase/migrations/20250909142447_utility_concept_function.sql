CREATE OR REPLACE FUNCTION public.schema_of_concept(concept public."Concept")
RETURNS SETOF public."Concept" STRICT STABLE
ROWS 1
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public."Concept" WHERE id=concept.schema_id;
$$;
COMMENT ON FUNCTION public.schema_of_concept(public."Concept")
IS 'Computed one-to-one: returns the schema Concept for a given Concept (by schema_id).';

CREATE OR REPLACE FUNCTION public.instances_of_schema(schema public."Concept")
RETURNS SETOF public."Concept" STRICT STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT * from public."Concept" WHERE schema_id=schema.id;
$$;
COMMENT ON FUNCTION public.instances_of_schema(public."Concept")
IS 'Computed one-to-many: returns all Concept instances that are based on the given schema Concept.';
