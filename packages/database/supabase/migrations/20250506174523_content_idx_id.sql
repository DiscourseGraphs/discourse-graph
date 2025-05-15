CREATE UNIQUE INDEX "Content_space_and_id" ON "Content" (space_id, source_local_id) WHERE
source_local_id IS NOT NULL;
