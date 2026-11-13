SET local check_function_bodies = off;

COMMENT ON COLUMN "public"."SpaceAccess"."permissions" IS 'The permission this account has on this space';

COMMENT ON FUNCTION "public"."concept_in_relations"(public."Concept") IS 'Computed one-to-many: returns all Concept instances that are relations including the current concept.';

COMMENT ON FUNCTION "public"."concept_in_relations"(public.my_concepts) IS 'Computed one-to-many: returns all Concept instances that are relations including the current concept.';

COMMENT ON FUNCTION "public"."concept_in_space"(bigint, public."SpaceAccessPermissions") IS 'security utility: does current user have access to this concept''s space?';

COMMENT ON FUNCTION "public"."concepts_of_relation"(public."Concept") IS 'Computed one-to-many: returns all Concept instances are referred to in the current concept.';

COMMENT ON FUNCTION "public"."concepts_of_relation"(public.my_concepts) IS 'Computed one-to-many: returns all Concept instances are referred to in the current concept.';

COMMENT ON FUNCTION "public"."content_in_space"(bigint, public."SpaceAccessPermissions") IS 'security utility: does current user have access to this content''s space?';

COMMENT ON FUNCTION "public"."content_of_concept"(public.my_concepts) IS 'Computed one-to-one: returns the representing Content for a given Concept.';

COMMENT ON FUNCTION "public"."document_in_space"(bigint, public."SpaceAccessPermissions") IS 'security utility: does current user have access to this document''s space?';

COMMENT ON FUNCTION "public"."in_space"(bigint, public."SpaceAccessPermissions") IS 'security utility: does current user have access to this space?';

COMMENT ON FUNCTION "public"."instances_of_schema"(public.my_concepts) IS 'Computed one-to-many: returns all Concept instances that are based on the given schema Concept.';

COMMENT ON FUNCTION "public"."my_space_ids"(public."SpaceAccessPermissions") IS 'security utility: all spaces the user has access to';

COMMENT ON FUNCTION "public"."schema_of_concept"(public.my_concepts) IS 'Computed one-to-one: returns the schema Concept for a given Concept (by schema_id).';
