ALTER TABLE public."FileReference" ADD COLUMN IF NOT EXISTS source_path character varying;

COMMENT ON COLUMN public."FileReference".source_path
IS 'Where the publishing platform kept the asset: a path in a vault, or a name in a flat asset namespace. Distinct from filepath, which holds what the content refers to. Null when the publisher did not record one. A destination names an imported asset from this, so it never has to inspect filepath for provenance.';

CREATE OR REPLACE VIEW public.my_file_references AS
SELECT
    source_local_id,
    space_id,
    filepath,
    filehash,
    created,
    last_modified,
    source_path
FROM public."FileReference"
    LEFT OUTER JOIN public.my_accessible_resources() AS ra USING (space_id, source_local_id)
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR (space_id = any(public.my_space_ids('partial')) AND ra.space_id IS NOT NULL)
);
