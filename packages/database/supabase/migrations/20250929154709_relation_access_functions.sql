
CREATE OR REPLACE FUNCTION public.concept_in_relations(concept "Concept")
 RETURNS SETOF "Concept"
 LANGUAGE sql
 STABLE STRICT
 SET search_path TO ''
AS $function$
    SELECT * from public."Concept" WHERE refs @> ARRAY[concept.id];
$function$
;

CREATE OR REPLACE FUNCTION public.concepts_of_relation(relation "Concept")
 RETURNS SETOF "Concept"
 LANGUAGE sql
 STABLE STRICT
 SET search_path TO ''
AS $function$
    SELECT * from public."Concept" WHERE id = any(relation.refs);
$function$
;
