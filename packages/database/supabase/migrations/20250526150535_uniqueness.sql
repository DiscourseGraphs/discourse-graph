-- Space

CREATE UNIQUE INDEX IF NOT EXISTS platform_url_idx ON public."Platform" USING btree (url);

ALTER TABLE public."Space" ALTER COLUMN url SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS space_url_idx ON public."Space" USING btree (url);

-- Agents

ALTER TABLE public."AutomatedAgent" ALTER COLUMN version SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS automated_agent_name_version_idx ON public."AutomatedAgent" USING btree (name, version);

CREATE UNIQUE INDEX IF NOT EXISTS person_email_idx ON public."Person" USING btree (email);
CREATE UNIQUE INDEX IF NOT EXISTS person_orcid_idx ON public."Person" USING btree (orcid);

-- Account

ALTER TABLE public."Account" RENAME COLUMN "person_id" TO "agent_id";

ALTER TABLE public."Account" RENAME CONSTRAINT "Account_person_id_fkey" TO "Account_agent_id_fkey";

ALTER TABLE public."Account" ADD COLUMN account_local_id character varying;

UPDATE public."Account" SET account_local_id = (SELECT email FROM public."Person" AS p WHERE p.id = agent_id);

ALTER TABLE public."Account"  ALTER COLUMN "account_local_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS account_platform_and_local_id_idx ON public."Account" USING btree (platform_id, account_local_id);

-- Document and Content

CREATE UNIQUE INDEX IF NOT EXISTS document_space_and_local_id_idx ON public."Document" USING btree (space_id, source_local_id) WHERE (space_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS document_url_idx ON public."Document" USING btree (url);

DROP INDEX IF EXISTS public."Content_space_and_id";

CREATE UNIQUE INDEX IF NOT EXISTS content_space_and_local_id_idx ON public."Content" USING btree (space_id, source_local_id) WHERE (space_id IS NOT NULL);

-- Concept

ALTER TABLE public."Concept" ALTER COLUMN "space_id" set not null;

CREATE UNIQUE INDEX IF NOT EXISTS concept_space_and_name_idx ON public."Concept" USING btree (space_id, name);


-- SpaceAccess

ALTER TABLE public."SpaceAccess" DROP CONSTRAINT "SpaceAccess_account_id_space_id_key";

ALTER TABLE public."SpaceAccess" DROP CONSTRAINT "SpaceAccess_pkey";

ALTER TABLE public."SpaceAccess" DROP COLUMN "id";
ALTER TABLE public."SpaceAccess" ALTER COLUMN "space_id" set not null;

CREATE UNIQUE INDEX IF NOT EXISTS "SpaceAccess_pkey" ON public."SpaceAccess" USING btree (space_id, account_id);

ALTER TABLE public."SpaceAccess" add constraint "SpaceAccess_pkey" PRIMARY KEY using index "SpaceAccess_pkey";

COMMENT ON COLUMN public."SpaceAccess".account_id IS 'The identity of the account in this space';
