DROP INDEX IF EXISTS "public"."document_space_and_local_id_idx";
CREATE UNIQUE INDEX document_space_and_local_id_idx ON public."Document" USING btree (space_id, source_local_id) NULLS DISTINCT;

DROP INDEX IF EXISTS "public"."content_space_and_local_id_idx";
CREATE UNIQUE INDEX content_space_and_local_id_idx ON public."Content" USING btree (space_id, source_local_id) NULLS DISTINCT;
