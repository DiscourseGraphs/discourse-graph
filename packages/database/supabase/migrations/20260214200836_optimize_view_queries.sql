CREATE OR REPLACE VIEW public.my_documents AS
SELECT
    id,
    space_id,
    source_local_id,
    url,
    "created",
    metadata,
    last_modified,
    author_id,
    contents
FROM
    public."Document"
LEFT OUTER JOIN public."ResourceAccess" AS ra USING (space_id, source_local_id)
LEFT OUTER JOIN public.my_user_accounts() ON (account_uid = my_user_accounts)
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR (space_id = any(public.my_space_ids('partial')) AND my_user_accounts IS NOT NULL)
);

CREATE OR REPLACE VIEW public.my_contents AS
SELECT
    id,
    document_id,
    source_local_id,
    variant,
    author_id,
    creator_id,
    created,
    text,
    metadata,
    scale,
    space_id,
    last_modified,
    part_of_id
FROM public."Content"
LEFT OUTER JOIN public."ResourceAccess" AS ra USING (space_id, source_local_id)
LEFT OUTER JOIN public.my_user_accounts() ON (account_uid = my_user_accounts)
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR (space_id = any(public.my_space_ids('partial')) AND my_user_accounts IS NOT NULL)
);


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
    source_local_id
FROM public."Concept"
LEFT OUTER JOIN public."ResourceAccess" AS ra USING (space_id, source_local_id)
LEFT OUTER JOIN public.my_user_accounts() ON (account_uid = my_user_accounts)
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR (space_id = any(public.my_space_ids('partial')) AND my_user_accounts IS NOT NULL)
);

CREATE OR REPLACE VIEW public.my_file_references AS
SELECT
    source_local_id,
    space_id,
    filepath,
    filehash,
    created,
    last_modified
FROM public."FileReference"
LEFT OUTER JOIN public."ResourceAccess" AS ra USING (space_id, source_local_id)
LEFT OUTER JOIN public.my_user_accounts() ON (account_uid = my_user_accounts)
WHERE (
    space_id = any(public.my_space_ids('reader'))
    OR (space_id = any(public.my_space_ids('partial')) AND my_user_accounts IS NOT NULL)
);
