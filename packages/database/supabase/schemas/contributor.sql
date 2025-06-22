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
