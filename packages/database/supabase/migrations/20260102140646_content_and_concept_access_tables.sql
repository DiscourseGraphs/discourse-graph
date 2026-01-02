CREATE TABLE IF NOT EXISTS public."ContentAccess" (
    account_uid UUID NOT NULL,
    content_id bigint NOT NULL
);

ALTER TABLE ONLY public."ContentAccess"
ADD CONSTRAINT "ContentAccess_pkey" PRIMARY KEY (account_uid, content_id);

ALTER TABLE public."ContentAccess" OWNER TO "postgres";

COMMENT ON TABLE public."ContentAccess" IS 'An access control entry for a content';

COMMENT ON COLUMN public."ContentAccess".content_id IS 'The content in which the content is located';

COMMENT ON COLUMN public."ContentAccess".account_uid IS 'The identity of the user account';

ALTER TABLE ONLY public."ContentAccess"
ADD CONSTRAINT "ContentAccess_account_uid_fkey" FOREIGN KEY (
    account_uid
) REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX content_access_content_id_idx ON public."ContentAccess" (content_id);

ALTER TABLE ONLY public."ContentAccess"
ADD CONSTRAINT "ContentAccess_content_id_fkey" FOREIGN KEY (
    content_id
) REFERENCES public."Content" (
    id
) ON UPDATE CASCADE ON DELETE CASCADE;

GRANT ALL ON TABLE public."ContentAccess" TO authenticated;
GRANT ALL ON TABLE public."ContentAccess" TO service_role;
REVOKE ALL ON TABLE public."ContentAccess" FROM anon;

CREATE OR REPLACE FUNCTION public.can_view_specific_content(id BIGINT) RETURNS BOOLEAN
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS(
        SELECT true FROM public."ContentAccess"
        JOIN public.my_user_accounts() ON (account_uid=my_user_accounts)
        WHERE content_id=id
        LIMIT 1);
$$;

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
WHERE (
    space_id = any(public.my_space_ids())
    OR public.can_view_specific_content(id)
);

DROP POLICY IF EXISTS content_policy ON public."Content";
CREATE POLICY content_select_policy ON public."Content" FOR SELECT USING (public.in_space(space_id) OR public.can_view_specific_content(id));
CREATE POLICY content_delete_policy ON public."Content" FOR DELETE USING (public.in_space(space_id));
CREATE POLICY content_insert_policy ON public."Content" FOR INSERT WITH CHECK (public.in_space(space_id));
CREATE POLICY content_update_policy ON public."Content" FOR UPDATE WITH CHECK (public.in_space(space_id));


CREATE TABLE IF NOT EXISTS public."ConceptAccess" (
    account_uid UUID NOT NULL,
    concept_id bigint NOT NULL
);

ALTER TABLE ONLY public."ConceptAccess"
ADD CONSTRAINT "ConceptAccess_pkey" PRIMARY KEY (account_uid, concept_id);

ALTER TABLE public."ConceptAccess" OWNER TO "postgres";

COMMENT ON TABLE public."ConceptAccess" IS 'An access control entry for a concept';

COMMENT ON COLUMN public."ConceptAccess".concept_id IS 'The concept in which the concept is located';

COMMENT ON COLUMN public."ConceptAccess".account_uid IS 'The identity of the user account';

ALTER TABLE ONLY public."ConceptAccess"
ADD CONSTRAINT "ConceptAccess_account_uid_fkey" FOREIGN KEY (
    account_uid
) REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX concept_access_concept_id_idx ON public."ConceptAccess" (concept_id);

ALTER TABLE ONLY public."ConceptAccess"
ADD CONSTRAINT "ConceptAccess_concept_id_fkey" FOREIGN KEY (
    concept_id
) REFERENCES public."Concept" (
    id
) ON UPDATE CASCADE ON DELETE CASCADE;

GRANT ALL ON TABLE public."ConceptAccess" TO authenticated;
GRANT ALL ON TABLE public."ConceptAccess" TO service_role;
REVOKE ALL ON TABLE public."ConceptAccess" FROM anon;

CREATE OR REPLACE FUNCTION public.can_view_specific_concept(id BIGINT) RETURNS BOOLEAN
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS(
        SELECT true FROM public."ConceptAccess"
        JOIN public.my_user_accounts() ON (account_uid=my_user_accounts)
        WHERE concept_id=id
        LIMIT 1);
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
    represented_by_id
FROM public."Concept"
WHERE (
    space_id = any(public.my_space_ids())
    OR public.can_view_specific_concept(id)
);

DROP POLICY IF EXISTS concept_policy ON public."Concept";
CREATE POLICY concept_select_policy ON public."Concept" FOR SELECT USING (public.in_space(space_id) OR public.can_view_specific_concept(id));
CREATE POLICY concept_delete_policy ON public."Concept" FOR DELETE USING (public.in_space(space_id));
CREATE POLICY concept_insert_policy ON public."Concept" FOR INSERT WITH CHECK (public.in_space(space_id));
CREATE POLICY concept_update_policy ON public."Concept" FOR UPDATE WITH CHECK (public.in_space(space_id));
