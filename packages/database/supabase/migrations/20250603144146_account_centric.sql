COMMENT ON TYPE public."EntityType" IS 'The type of an entity';

CREATE TYPE public."PlatformE" AS ENUM (
    'Roam',
    'Obsidian'
);

ALTER TYPE public."PlatformE" OWNER TO postgres;

CREATE TYPE public."AgentType" AS ENUM (
    'person',
    'organization',
    'automated_agent'
);

ALTER TYPE public."AgentType" OWNER TO postgres;

COMMENT ON TYPE public."AgentType" IS 'The type of agent';

ALTER TYPE public."EntityType" RENAME VALUE 'Account' TO 'PlatformAccount';

ALTER TABLE public."Person" RENAME TO "PlatformAccount";

ALTER INDEX "Person_pkey" RENAME TO "PlatformAccount_pkey";

ALTER TABLE public."PlatformAccount" DROP CONSTRAINT "person_id_fkey";

ALTER TABLE "public"."PlatformAccount" ALTER COLUMN "id" SET DEFAULT nextval('entity_id_seq'::regclass);

DROP TABLE public."AutomatedAgent";

ALTER TABLE public."PlatformAccount" ADD COLUMN platform public."PlatformE";

ALTER TABLE public."PlatformAccount" ADD COLUMN write_permission BOOLEAN DEFAULT TRUE;

ALTER TABLE public."PlatformAccount" ADD COLUMN active BOOLEAN DEFAULT TRUE;

ALTER TABLE public."PlatformAccount" ADD COLUMN agent_type public."AgentType" NOT NULL DEFAULT 'person';

ALTER TABLE public."PlatformAccount" ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';

ALTER TABLE public."PlatformAccount" ADD COLUMN dg_account UUID;

ALTER TABLE public."PlatformAccount" ADD COLUMN account_local_id VARCHAR;

COMMENT ON TABLE public."PlatformAccount" IS 'An account for an agent on a platform';

CREATE INDEX platform_account_dg_account_idx ON public."PlatformAccount" (dg_account);

WITH s AS (SELECT agent_id, write_permission, active, account_local_id
      FROM public."Account"
      JOIN public."Platform" AS p ON (platform_id=p.id)
      WHERE url='https://roamresearch.com')
UPDATE public."PlatformAccount" AS pa
  SET platform = 'Roam',
      active = s.active,
      write_permission = s.write_permission,
      account_local_id = s.account_local_id
  FROM s
  WHERE pa.id = s.agent_id;

DELETE FROM public."PlatformAccount" WHERE account_local_id IS NULL;

CREATE UNIQUE INDEX account_platform_and_id_idx ON public."PlatformAccount" (account_local_id, platform);


ALTER TABLE public."PlatformAccount" ADD FOREIGN KEY(dg_account) REFERENCES auth.users (id) ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE ONLY public."SpaceAccess" DROP CONSTRAINT "SpaceAccess_account_id_fkey";

WITH s AS (SELECT id, agent_id FROM public."Account")
UPDATE public."SpaceAccess" as sa SET account_id=s.agent_id FROM s WHERE sa.account_id = s.id;

ALTER TABLE ONLY public."SpaceAccess"
ADD CONSTRAINT "SpaceAccess_account_id_fkey" FOREIGN KEY (
    account_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE CASCADE;

DROP TABLE public."Account";


CREATE TYPE public."AgentIdentifierType" AS ENUM (
    'email',
    'orcid'
);

ALTER TYPE public."AgentIdentifierType" OWNER TO postgres;

COMMENT ON TYPE public."AgentIdentifierType" IS 'A namespace for identifiers that can help identify an agent';

CREATE TABLE public."AgentIdentifier" (
	identifier_type public."AgentIdentifierType" NOT NULL,
	account_id BIGINT NOT NULL,
	value VARCHAR NOT NULL,
  PRIMARY KEY (value, identifier_type, account_id),
	FOREIGN KEY(account_id) REFERENCES public."PlatformAccount" (id)
);


ALTER TABLE public."AgentIdentifier" OWNER TO "postgres";

COMMENT ON TABLE public."AgentIdentifier" IS 'An identifying attribute associated with an account, can be a basis for unification';

GRANT ALL ON TABLE public."AgentIdentifier" TO anon;
GRANT ALL ON TABLE public."AgentIdentifier" TO authenticated;
GRANT ALL ON TABLE public."AgentIdentifier" TO service_role;


INSERT INTO public."AgentIdentifier" SELECT 'email', id, email from public."PlatformAccount";

ALTER TABLE public."PlatformAccount" DROP COLUMN email;

INSERT INTO public."AgentIdentifier" SELECT 'orcid', id, orcid from public."PlatformAccount" WHERE orcid IS NOT NULL;
ALTER TABLE public."PlatformAccount" DROP COLUMN orcid;


ALTER TABLE public."PlatformAccount" ALTER COLUMN platform SET NOT NULL;
ALTER TABLE public."PlatformAccount" ALTER COLUMN account_local_id SET NOT NULL;
ALTER TABLE public."PlatformAccount" ALTER COLUMN write_permission SET NOT NULL;
ALTER TABLE public."PlatformAccount" ALTER COLUMN active SET NOT NULL;

ALTER TABLE public."Space" ADD COLUMN platform public."PlatformE";

WITH s AS (SELECT id
      FROM public."Platform"
      WHERE url='https://roamresearch.com')
UPDATE public."Space" AS space
  SET platform = 'Roam'
  FROM s
  WHERE platform_id = s.id;

ALTER TABLE public."Space" DROP COLUMN platform_id;

ALTER TABLE public."Space" ALTER COLUMN "platform" SET NOT NULL;

DROP TABLE public."Platform";
ALTER TYPE public."PlatformE" RENAME TO "Platform";

ALTER TABLE ONLY public."Document" DROP CONSTRAINT "Document_author_id_fkey";

ALTER TABLE ONLY public."Document"
ADD CONSTRAINT "Document_author_id_fkey" FOREIGN KEY (
    author_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."Content" DROP CONSTRAINT "Content_author_id_fkey";
ALTER TABLE ONLY public."Content"
ADD CONSTRAINT "Content_author_id_fkey" FOREIGN KEY (
    author_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Content" DROP CONSTRAINT "Content_creator_id_fkey";
ALTER TABLE ONLY public."Content"
ADD CONSTRAINT "Content_creator_id_fkey" FOREIGN KEY (
    creator_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY public."Concept" DROP CONSTRAINT "Concept_author_id_fkey";
ALTER TABLE ONLY public."Concept"
ADD CONSTRAINT "Concept_author_id_fkey" FOREIGN KEY (
    author_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE SET NULL;


ALTER TABLE ONLY public.content_contributors DROP CONSTRAINT content_contributors_contributor_id_fkey;
ALTER TABLE ONLY public.content_contributors
ADD CONSTRAINT content_contributors_contributor_id_fkey FOREIGN KEY (
    contributor_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.concept_contributors DROP CONSTRAINT concept_contributors_contributor_id_fkey;
ALTER TABLE ONLY public.concept_contributors
ADD CONSTRAINT concept_contributors_contributor_id_fkey FOREIGN KEY (
    contributor_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE CASCADE;


DROP TABLE public."Agent";
