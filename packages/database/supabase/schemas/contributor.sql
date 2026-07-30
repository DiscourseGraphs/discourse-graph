CREATE TABLE IF NOT EXISTS public.content_contributors (
    content_id bigint NOT NULL,
    contributor_id bigint NOT NULL
);

ALTER TABLE ONLY public.content_contributors
ADD CONSTRAINT content_contributors_pkey PRIMARY KEY (
    content_id, contributor_id
);

ALTER TABLE ONLY public.content_contributors
ADD CONSTRAINT content_contributors_content_id_fkey FOREIGN KEY (
    content_id
) REFERENCES public."Content" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.content_contributors
ADD CONSTRAINT content_contributors_contributor_id_fkey FOREIGN KEY (
    contributor_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.content_contributors OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS public.concept_contributors (
    concept_id bigint NOT NULL,
    contributor_id bigint NOT NULL
);

ALTER TABLE public.concept_contributors OWNER TO "postgres";

ALTER TABLE ONLY public.concept_contributors
ADD CONSTRAINT concept_contributors_concept_id_fkey FOREIGN KEY (
    concept_id
) REFERENCES public."Concept" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.concept_contributors
ADD CONSTRAINT concept_contributors_contributor_id_fkey FOREIGN KEY (
    contributor_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.concept_contributors
ADD CONSTRAINT concept_contributors_pkey PRIMARY KEY (
    concept_id, contributor_id
);

GRANT ALL ON TABLE public.concept_contributors TO anon;
GRANT ALL ON TABLE public.concept_contributors TO authenticated;
GRANT ALL ON TABLE public.concept_contributors TO service_role;

GRANT ALL ON TABLE public.content_contributors TO anon;
GRANT ALL ON TABLE public.content_contributors TO authenticated;
GRANT ALL ON TABLE public.content_contributors TO service_role;

ALTER TABLE public.concept_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_contributors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS concept_contributors_policy ON public.concept_contributors;
DROP POLICY IF EXISTS concept_contributors_select_policy ON public.concept_contributors;
CREATE POLICY concept_contributors_select_policy ON public.concept_contributors FOR SELECT USING (public.concept_in_space(concept_id) OR public.can_view_concept(concept_id));
DROP POLICY IF EXISTS concept_contributors_delete_policy ON public.concept_contributors;
CREATE POLICY concept_contributors_delete_policy ON public.concept_contributors FOR DELETE USING (public.concept_in_space(concept_id, 'editor'));
DROP POLICY IF EXISTS concept_contributors_insert_policy ON public.concept_contributors;
CREATE POLICY concept_contributors_insert_policy ON public.concept_contributors FOR INSERT WITH CHECK (public.concept_in_space(concept_id, 'editor'));
DROP POLICY IF EXISTS concept_contributors_update_policy ON public.concept_contributors;
CREATE POLICY concept_contributors_update_policy ON public.concept_contributors FOR UPDATE USING (public.concept_in_space(concept_id, 'editor'));

DROP POLICY IF EXISTS content_contributors_policy ON public.content_contributors;
DROP POLICY IF EXISTS content_contributors_select_policy ON public.content_contributors;
CREATE POLICY content_contributors_select_policy ON public.content_contributors FOR SELECT USING (public.content_in_space(content_id) OR public.can_view_content(content_id));
DROP POLICY IF EXISTS content_contributors_delete_policy ON public.content_contributors;
CREATE POLICY content_contributors_delete_policy ON public.content_contributors FOR DELETE USING (public.content_in_space(content_id, 'editor'));
DROP POLICY IF EXISTS content_contributors_insert_policy ON public.content_contributors;
CREATE POLICY content_contributors_insert_policy ON public.content_contributors FOR INSERT WITH CHECK (public.content_in_space(content_id, 'editor'));
DROP POLICY IF EXISTS content_contributors_update_policy ON public.content_contributors;
CREATE POLICY content_contributors_update_policy ON public.content_contributors FOR UPDATE USING (public.content_in_space(content_id, 'editor'));
