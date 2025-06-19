CREATE TYPE public."Platform" AS ENUM (
    'Roam',
    'Obsidian'
);

ALTER TYPE public."Platform" OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public."Space" (
    id bigint DEFAULT nextval(
        'public."entity_id_seq"'::regclass
    ) NOT NULL,
    url character varying NOT NULL,
    name character varying NOT NULL,
    platform public."Platform" NOT NULL
);

ALTER TABLE ONLY public."Space"
ADD CONSTRAINT "Space_pkey" PRIMARY KEY (id);

CREATE UNIQUE INDEX space_url_idx ON public."Space" USING btree (url);

COMMENT ON TABLE public."Space" IS
'A space on a platform representing a community engaged in a conversation';

ALTER TABLE public."Space" OWNER TO "postgres";

GRANT ALL ON TABLE public."Space" TO anon;
GRANT ALL ON TABLE public."Space" TO authenticated;
GRANT ALL ON TABLE public."Space" TO service_role;
