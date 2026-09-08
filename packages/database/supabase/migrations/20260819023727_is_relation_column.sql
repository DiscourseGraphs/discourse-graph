ALTER TABLE public."Concept" ALTER COLUMN arity DROP EXPRESSION;
ALTER TABLE public."Concept" ALTER COLUMN arity SET NOT NULL;
ALTER TABLE public."Concept" ADD COLUMN is_relation boolean;

CREATE OR REPLACE FUNCTION public.compute_arity_local(schema_id BIGINT, lit_content JSONB)
RETURNS smallint STABLE
SET search_path = ''
LANGUAGE sql
AS $$
  SELECT CASE WHEN schema_id IS NULL THEN (
    SELECT COALESCE(jsonb_array_length(lit_content->'roles'), 0)
  ) ELSE (
    SELECT COALESCE(jsonb_array_length(literal_content->'roles'), 0) FROM public."Concept" WHERE id=compute_arity_local.schema_id
  ) END;
$$;

CREATE OR REPLACE FUNCTION public.compute_is_relation_local(schema_id BIGINT, lit_content JSONB)
RETURNS boolean STABLE
SET search_path = ''
LANGUAGE sql
AS $$
  SELECT CASE WHEN schema_id IS NULL THEN (
    SELECT lit_content @> '{"roles":["source","destination"]}'::jsonb
  ) ELSE (
    SELECT literal_content  @> '{"roles":["source","destination"]}'::jsonb FROM public."Concept" WHERE id=compute_is_relation_local.schema_id
  ) END;
$$;

CREATE OR REPLACE VIEW public.my_concepts AS
SELECT
    id,
    epistemic_status,
    name,
    description,
    author_id,
    created,
    last_modified,
    space_id,
    arity,
    schema_id,
    literal_content,
    reference_content,
    refs,
    is_schema,
    source_local_id,
    is_relation
FROM public."Concept"
    LEFT OUTER JOIN public.my_accessible_resources() AS ra USING (space_id, source_local_id)
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR (space_id = any(public.my_space_ids('partial')) AND ra.space_id IS NOT null)
);

CREATE OR REPLACE FUNCTION public.concept_set_derived_columns() RETURNS TRIGGER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.arity := public.compute_arity_local(NEW.schema_id, NEW.literal_content);
    NEW.is_relation := public.compute_is_relation_local(NEW.schema_id, NEW.literal_content);
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.concept_set_derived_columns
IS 'Maintains the derived arity and is_relation columns; values supplied by the writer are always overridden.';

DROP TRIGGER IF EXISTS concept_set_derived_columns_trigger ON public."Concept";
CREATE TRIGGER concept_set_derived_columns_trigger
    BEFORE INSERT OR UPDATE ON public."Concept"
    FOR EACH ROW EXECUTE FUNCTION public.concept_set_derived_columns();

CREATE OR REPLACE FUNCTION public.concept_propagate_derived_columns() RETURNS TRIGGER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
    -- The instances' own BEFORE trigger will recompute the same values; we compute them
    -- here only to avoid rewriting rows whose derived values did not actually change.
    UPDATE public."Concept" AS instance SET
        arity = public.compute_arity_local(instance.schema_id, instance.literal_content),
        is_relation = public.compute_is_relation_local(instance.schema_id, instance.literal_content)
    WHERE instance.schema_id = NEW.id
    AND (
        instance.arity IS DISTINCT FROM public.compute_arity_local(instance.schema_id, instance.literal_content)
        OR instance.is_relation IS DISTINCT FROM public.compute_is_relation_local(instance.schema_id, instance.literal_content)
    );
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.concept_propagate_derived_columns
IS 'Recomputes arity and is_relation of the instances of a schema Concept whose literal_content changed.';

DROP TRIGGER IF EXISTS concept_propagate_derived_columns_trigger ON public."Concept";
-- The WHEN clause also stops the recursion: the propagated UPDATE does not touch literal_content.
CREATE TRIGGER concept_propagate_derived_columns_trigger
    AFTER UPDATE ON public."Concept"
    FOR EACH ROW WHEN (NEW.is_schema AND OLD.literal_content IS DISTINCT FROM NEW.literal_content)
    EXECUTE FUNCTION public.concept_propagate_derived_columns();

-- do schemas first, so their values are correct for next step
UPDATE public."Concept" SET is_relation=public.compute_is_relation_local(null::BIGINT, literal_content) WHERE schema_id IS NULL;
UPDATE public."Concept" SET is_relation=public.compute_is_relation_local(null::BIGINT, literal_content) WHERE schema_id IS NOT NULL;

ALTER TABLE public."Concept" ALTER COLUMN is_relation SET NOT NULL;
