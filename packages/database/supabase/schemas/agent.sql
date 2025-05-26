CREATE TABLE IF NOT EXISTS public."Agent" (
    id bigint DEFAULT nextval(
        'public.entity_id_seq'::regclass
    ) NOT NULL,
    type public."EntityType" NOT NULL
);


ALTER TABLE ONLY public."Agent"
ADD CONSTRAINT "Agent_pkey" PRIMARY KEY (id);

ALTER TABLE public."Agent" OWNER TO "postgres";

COMMENT ON TABLE public."Agent" IS 'An agent that acts in the system';

CREATE TABLE IF NOT EXISTS public."AutomatedAgent" (
    id bigint NOT NULL,
    name character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    deterministic boolean DEFAULT false,
    version character varying NOT NULL
);

ALTER TABLE ONLY public."AutomatedAgent"
ADD CONSTRAINT "AutomatedAgent_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY public."AutomatedAgent"
ADD CONSTRAINT automated_agent_id_fkey FOREIGN KEY (
    id
) REFERENCES public."Agent" (id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE UNIQUE INDEX automated_agent_name_version_idx ON public."AutomatedAgent" USING btree (name, version);

ALTER TABLE public."AutomatedAgent" OWNER TO "postgres";

COMMENT ON TABLE public."AutomatedAgent" IS 'An automated agent';

CREATE TABLE IF NOT EXISTS public."Person" (
    id bigint NOT NULL,
    name character varying NOT NULL,
    orcid character varying(20),
    email character varying NOT NULL
);

ALTER TABLE ONLY public."Person"
ADD CONSTRAINT "Person_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY public."Person"
ADD CONSTRAINT person_id_fkey FOREIGN KEY (
    id
) REFERENCES public."Agent" (id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE UNIQUE INDEX person_email_idx ON public."Person" USING btree (email);
CREATE UNIQUE INDEX person_orcid_idx ON public."Person" USING btree (orcid);

ALTER TABLE public."Person" OWNER TO "postgres";

COMMENT ON TABLE public."Person" IS 'A person using the system';


GRANT ALL ON TABLE public."Agent" TO anon;
GRANT ALL ON TABLE public."Agent" TO authenticated;
GRANT ALL ON TABLE public."Agent" TO service_role;

GRANT ALL ON TABLE public."AutomatedAgent" TO anon;
GRANT ALL ON TABLE public."AutomatedAgent" TO authenticated;
GRANT ALL ON TABLE public."AutomatedAgent" TO service_role;

GRANT ALL ON TABLE public."Person" TO anon;
GRANT ALL ON TABLE public."Person" TO authenticated;
GRANT ALL ON TABLE public."Person" TO service_role;
