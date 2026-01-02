CREATE OR REPLACE FUNCTION public.can_access_account(account_uid UUID) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT account_uid = auth.uid() OR EXISTS (
        SELECT 1 FROM public.group_membership
        WHERE member_id = auth.uid() AND group_id=account_uid
        LIMIT 1
    );
$$;

COMMENT ON FUNCTION public.can_access_account IS 'security utility: Is this my account or one of my groups?';

CREATE OR REPLACE FUNCTION public.my_editable_space_ids() RETURNS BIGINT []
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT COALESCE(array_agg(distinct space_id), '{}') AS ids
        FROM public."SpaceAccess"
        JOIN public.my_user_accounts() ON (account_uid = my_user_accounts)
        WHERE editor;
$$;
COMMENT ON FUNCTION public.my_editable_space_ids IS 'security utility: all spaces the user has edit access to';


CREATE OR REPLACE FUNCTION public.editor_in_space(space_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS (SELECT 1 FROM public."SpaceAccess" AS sa
        JOIN public.my_user_accounts() ON (sa.account_uid = my_user_accounts)
        WHERE sa.space_id = editor_in_space.space_id AND sa.editor);
$$;

COMMENT ON FUNCTION public.editor_in_space IS 'security utility: does current user have edit access to this space?';

CREATE OR REPLACE FUNCTION public.content_in_editable_space(content_id BIGINT) RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.editor_in_space(space_id) FROM public."Content" WHERE id=content_id
$$;

COMMENT ON FUNCTION public.content_in_editable_space IS 'security utility: does current user have editor access to this content''s space?';

CREATE OR REPLACE FUNCTION public.concept_in_editable_space(concept_id BIGINT) RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.editor_in_space(space_id) FROM public."Concept" WHERE id=concept_id
$$;

COMMENT ON FUNCTION public.concept_in_editable_space IS 'security utility: does current user have editor access to this concept''s space?';

CREATE TABLE IF NOT EXISTS public."ContentAccess" (
    account_uid UUID NOT NULL,
    content_id bigint NOT NULL
);

ALTER TABLE ONLY public."ContentAccess"
ADD CONSTRAINT "ContentAccess_pkey" PRIMARY KEY (account_uid, content_id);

ALTER TABLE public."ContentAccess" OWNER TO "postgres";

COMMENT ON TABLE public."ContentAccess" IS 'An access control entry for a content';

COMMENT ON COLUMN public."ContentAccess".content_id IS 'The content item for which access is granted';

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

ALTER TABLE public."ContentAccess" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_access_policy ON public."ContentAccess";
DROP POLICY IF EXISTS content_access_select_policy ON public."ContentAccess";
CREATE POLICY content_access_select_policy ON public."ContentAccess" FOR SELECT USING (public.content_in_space(content_id) OR public.can_access_account(account_uid));
DROP POLICY IF EXISTS content_access_delete_policy ON public."ContentAccess";
CREATE POLICY content_access_delete_policy ON public."ContentAccess" FOR DELETE USING (public.content_in_editable_space(content_id) OR public.can_access_account(account_uid));
DROP POLICY IF EXISTS content_access_insert_policy ON public."ContentAccess";
CREATE POLICY content_access_insert_policy ON public."ContentAccess" FOR INSERT WITH CHECK (public.content_in_editable_space(content_id));
DROP POLICY IF EXISTS content_access_update_policy ON public."ContentAccess";
CREATE POLICY content_access_update_policy ON public."ContentAccess" FOR UPDATE WITH CHECK (public.content_in_editable_space(content_id));


CREATE TABLE IF NOT EXISTS public."ConceptAccess" (
    account_uid UUID NOT NULL,
    concept_id bigint NOT NULL
);

ALTER TABLE ONLY public."ConceptAccess"
ADD CONSTRAINT "ConceptAccess_pkey" PRIMARY KEY (account_uid, concept_id);

ALTER TABLE public."ConceptAccess" OWNER TO "postgres";

COMMENT ON TABLE public."ConceptAccess" IS 'An access control entry for a concept';

COMMENT ON COLUMN public."ConceptAccess".concept_id IS 'The concept item for which access is granted';

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

ALTER TABLE public."ConceptAccess" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS concept_access_policy ON public."ConceptAccess";
DROP POLICY IF EXISTS concept_access_select_policy ON public."ConceptAccess";
CREATE POLICY concept_access_select_policy ON public."ConceptAccess" FOR SELECT USING (public.concept_in_space(concept_id) OR public.can_access_account(account_uid));
DROP POLICY IF EXISTS concept_access_delete_policy ON public."ConceptAccess";
CREATE POLICY concept_access_delete_policy ON public."ConceptAccess" FOR DELETE USING (public.concept_in_editable_space(concept_id) OR public.can_access_account(account_uid));
DROP POLICY IF EXISTS concept_access_insert_policy ON public."ConceptAccess";
CREATE POLICY concept_access_insert_policy ON public."ConceptAccess" FOR INSERT WITH CHECK (public.concept_in_editable_space(concept_id));
DROP POLICY IF EXISTS concept_access_update_policy ON public."ConceptAccess";
CREATE POLICY concept_access_update_policy ON public."ConceptAccess" FOR UPDATE WITH CHECK (public.concept_in_editable_space(concept_id));
