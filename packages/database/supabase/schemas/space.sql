CREATE TABLE IF NOT EXISTS public."Platform" (
    id bigint DEFAULT nextval(
        'public."entity_id_seq"'::regclass
    ) NOT NULL,
    name character varying NOT NULL,
    url character varying NOT NULL
);

ALTER TABLE public."Platform" OWNER TO "postgres";

COMMENT ON TABLE public."Platform" IS
'A data platform where discourse happens';

CREATE TABLE IF NOT EXISTS public."Space" (
    id bigint DEFAULT nextval(
        'public."entity_id_seq"'::regclass
    ) NOT NULL,
    url character varying,
    name character varying NOT NULL,
    platform_id bigint NOT NULL
);

ALTER TABLE public."Space" OWNER TO "postgres";

COMMENT ON TABLE public."Space" IS
'A space on a platform representing a community engaged in a conversation';

ALTER TABLE ONLY public."Platform"
ADD CONSTRAINT "Platform_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY public."Space"
ADD CONSTRAINT "Space_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY public."Space"
ADD CONSTRAINT "Space_platform_id_fkey" FOREIGN KEY (
    platform_id
) REFERENCES public."Platform" (
    id
) ON UPDATE CASCADE ON DELETE CASCADE;

GRANT ALL ON TABLE public."Platform" TO anon;
GRANT ALL ON TABLE public."Platform" TO authenticated;
GRANT ALL ON TABLE public."Platform" TO service_role;

GRANT ALL ON TABLE public."Space" TO anon;
GRANT ALL ON TABLE public."Space" TO authenticated;
GRANT ALL ON TABLE public."Space" TO service_role;
