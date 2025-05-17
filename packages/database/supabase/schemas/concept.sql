CREATE TYPE public."EpistemicStatus" AS ENUM (
    'certainly_not',
    'strong_evidence_against',
    'could_be_false',
    'unknown',
    'uncertain',
    'contentious',
    'could_be_true',
    'strong_evidence_for',
    'certain'
);

ALTER TYPE public."EpistemicStatus" OWNER TO postgres;


CREATE TABLE IF NOT EXISTS public."Concept" (
    id bigint DEFAULT nextval(
        'public.entity_id_seq'::regclass
    ) NOT NULL,
    epistemic_status public."EpistemicStatus" DEFAULT 'unknown'::public."EpistemicStatus" NOT NULL,
    name character varying NOT NULL,
    description text,
    author_id bigint,
    created timestamp without time zone NOT NULL,
    last_modified timestamp without time zone NOT NULL,
    space_id bigint,
    arity smallint DEFAULT 0 NOT NULL,
    schema_id bigint,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_schema boolean DEFAULT false NOT NULL,
    represented_by_id bigint
);

ALTER TABLE public."Concept" OWNER TO "postgres";

COMMENT ON TABLE public."Concept" IS 'An abstract concept, claim or relation';

COMMENT ON COLUMN public."Concept".author_id IS 'The author of content';

COMMENT ON COLUMN public."Concept".created IS 'The time when the content was created in the remote source';

COMMENT ON COLUMN public."Concept".last_modified IS 'The last time the content was modified in the remote source';

COMMENT ON COLUMN public."Concept".space_id IS 'The space in which the content is located';


ALTER TABLE ONLY public."Concept"
ADD CONSTRAINT "Concept_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY public."Concept"
ADD FOREIGN KEY (represented_by_id) REFERENCES public."Content" (
    id
) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE ONLY public."Person"
ADD CONSTRAINT "Person_pkey" PRIMARY KEY (id);

CREATE INDEX "Concept_content" ON public."Concept" USING gin (
    content jsonb_path_ops
);

CREATE INDEX "Concept_schema" ON public."Concept" USING btree (schema_id);

CREATE INDEX "Concept_space" ON public."Concept" USING btree (space_id);

CREATE UNIQUE INDEX "Concept_represented_by" ON public."Concept" (
    represented_by_id
);


ALTER TABLE ONLY public."Concept"
ADD CONSTRAINT "Concept_author_id_fkey" FOREIGN KEY (
    author_id
) REFERENCES public."Agent" (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Concept"
ADD CONSTRAINT "Concept_schema_id_fkey" FOREIGN KEY (
    schema_id
) REFERENCES public."Concept" (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Concept"
ADD CONSTRAINT "Concept_space_id_fkey" FOREIGN KEY (
    space_id
) REFERENCES public."DiscourseSpace" (
    id
) ON UPDATE CASCADE ON DELETE CASCADE;


GRANT ALL ON TABLE public."Concept" TO anon;
GRANT ALL ON TABLE public."Concept" TO authenticated;
GRANT ALL ON TABLE public."Concept" TO service_role;


RESET ALL;
