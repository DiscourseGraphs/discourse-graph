CREATE TYPE public."AgentType" AS ENUM (
    'person',
    'organization',
    'automated_agent',
    'anonymous'
);

ALTER TYPE public."AgentType" OWNER TO postgres;

COMMENT ON TYPE public."AgentType" IS 'The type of agent';

CREATE TYPE public."AgentIdentifierType" AS ENUM (
    'email',
    'orcid'
);

ALTER TYPE public."AgentIdentifierType" OWNER TO postgres;

COMMENT ON TYPE public."AgentIdentifierType" IS 'A namespace for identifiers that can help identify an agent';


CREATE TABLE IF NOT EXISTS public."PlatformAccount" (
    id bigint DEFAULT nextval(
        'public.entity_id_seq'::regclass
    ) NOT NULL PRIMARY KEY,
    name VARCHAR NOT NULL,
    platform public."Platform" NOT NULL,
    account_local_id VARCHAR NOT NULL,
    write_permission BOOLEAN NOT NULL DEFAULT true,
    active BOOLEAN NOT NULL DEFAULT true,
    agent_type public."AgentType" NOT NULL DEFAULT 'person',
    metadata JSONB NOT NULL DEFAULT '{}',
    dg_account UUID,
    FOREIGN KEY (dg_account) REFERENCES auth.users (id) ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE public."PlatformAccount" OWNER TO "postgres";

COMMENT ON TABLE public."PlatformAccount" IS 'An account for an agent on a platform';

CREATE UNIQUE INDEX account_platform_and_id_idx ON public."PlatformAccount" (account_local_id, platform);

REVOKE ALL ON TABLE public."PlatformAccount" FROM anon;
GRANT ALL ON TABLE public."PlatformAccount" TO authenticated;
GRANT ALL ON TABLE public."PlatformAccount" TO service_role;

CREATE TABLE public."AgentIdentifier" (
    identifier_type public."AgentIdentifierType" NOT NULL,
    account_id BIGINT NOT NULL,
    value VARCHAR NOT NULL,
    trusted BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (value, identifier_type, account_id),
    FOREIGN KEY (account_id) REFERENCES public."PlatformAccount" (id)
);

ALTER TABLE public."AgentIdentifier" OWNER TO "postgres";

COMMENT ON TABLE public."AgentIdentifier" IS 'An identifying attribute associated with an account, can be a basis for unification';

REVOKE ALL ON TABLE public."AgentIdentifier" FROM anon;
GRANT ALL ON TABLE public."AgentIdentifier" TO authenticated;
GRANT ALL ON TABLE public."AgentIdentifier" TO service_role;

CREATE INDEX platform_account_dg_account_idx ON public."PlatformAccount" (dg_account);


CREATE TABLE IF NOT EXISTS public."SpaceAccess" (
    space_id bigint,
    account_id bigint NOT NULL,
    editor boolean NOT NULL
);

ALTER TABLE ONLY public."SpaceAccess"
ADD CONSTRAINT "SpaceAccess_pkey" PRIMARY KEY (space_id, account_id);


ALTER TABLE public."SpaceAccess" OWNER TO "postgres";

COMMENT ON TABLE public."SpaceAccess" IS 'An access control entry for a space';

COMMENT ON COLUMN public."SpaceAccess".space_id IS 'The space in which the content is located';

COMMENT ON COLUMN public."SpaceAccess".account_id IS 'The identity of the account in this space';

ALTER TABLE ONLY public."SpaceAccess"
ADD CONSTRAINT "SpaceAccess_account_id_fkey" FOREIGN KEY (
    account_id
) REFERENCES public."PlatformAccount" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."SpaceAccess"
ADD CONSTRAINT "SpaceAccess_space_id_fkey" FOREIGN KEY (
    space_id
) REFERENCES public."Space" (
    id
) ON UPDATE CASCADE ON DELETE CASCADE;

GRANT ALL ON TABLE public."SpaceAccess" TO anon;
GRANT ALL ON TABLE public."SpaceAccess" TO authenticated;
GRANT ALL ON TABLE public."SpaceAccess" TO service_role;

CREATE OR REPLACE FUNCTION public.create_account_in_space(
    space_id_ BIGINT,
    account_local_id_ varchar,
    name_ varchar,
    email_ varchar = null,
    email_trusted boolean = true,
    editor_ boolean = true
) RETURNS BIGINT
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    platform_ public."Platform";
    account_id_ BIGINT;
BEGIN
    SELECT platform INTO platform_ STRICT FROM public."Space" WHERE id = space_id_;
    INSERT INTO public."PlatformAccount" AS pa (
            account_local_id, name, platform
        ) VALUES (
            account_local_id_, name_, platform_
        ) ON CONFLICT (account_local_id, platform) DO UPDATE SET
            name = coalesce(name_, pa.name)
        RETURNING id INTO STRICT account_id_;
    INSERT INTO public."SpaceAccess" (space_id, account_id, editor) values (space_id_, account_id_, editor_)
        ON CONFLICT (space_id, account_id)
        DO UPDATE SET editor = editor_;
    IF email_ IS NOT NULL THEN
        INSERT INTO public."AgentIdentifier" (account_id, value, identifier_type, trusted) VALUES (account_id_, email_, 'email', email_trusted)
         ON CONFLICT (value, identifier_type, account_id)
         DO UPDATE SET trusted = email_trusted;
    END IF;
    RETURN account_id_;
END;
$$;


CREATE OR REPLACE FUNCTION public.in_space(space_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT COUNT(*) > 0 FROM public."SpaceAccess" AS sa
        JOIN public."PlatformAccount" AS pa ON (pa.id=sa.account_id)
        WHERE sa.space_id = $1 AND pa.dg_account = auth.uid();
$$;

COMMENT ON FUNCTION public.in_space IS 'security utility: does current user have access to this space?' ;


CREATE OR REPLACE FUNCTION public.account_in_shared_space (p_account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT COUNT(*) > 0 FROM public."PlatformAccount" AS my_account
        JOIN public."SpaceAccess" AS my_access ON (my_account.id=my_access.account_id)
        JOIN public."SpaceAccess" AS their_access ON (their_access.space_id = my_access.space_id AND their_access.account_id=p_account_id)
        WHERE my_account.dg_account = auth.uid();
$$ ;

COMMENT ON FUNCTION public.account_in_shared_space IS 'security utility: does current user share a space with this account?' ;


-- Space: Allow anyone to insert, but only users who are members of the space can update or select

ALTER TABLE public."Space" ENABLE ROW LEVEL SECURITY ;

DROP POLICY IF EXISTS space_insert_policy ON public."Space" ;
CREATE POLICY space_insert_policy ON public."Space" FOR INSERT WITH CHECK (true) ;

DROP POLICY IF EXISTS space_update_policy ON public."Space" ;
CREATE POLICY space_update_policy ON public."Space" FOR UPDATE USING (public.in_space (id)) ;

DROP POLICY IF EXISTS space_select_policy ON public."Space" ;
CREATE POLICY space_select_policy ON public."Space" FOR SELECT USING (public.in_space (id)) ;

-- PlatformAccount: Virtually no access unless to your own account

ALTER TABLE public."PlatformAccount" ENABLE ROW LEVEL SECURITY ;

DROP POLICY IF EXISTS platform_account_insert_policy ON public."PlatformAccount" ;
CREATE POLICY platform_account_insert_policy ON public."PlatformAccount" FOR INSERT WITH CHECK (dg_account = (select auth.uid ()) OR public.account_in_shared_space (id)) ;

DROP POLICY IF EXISTS platform_account_update_policy ON public."PlatformAccount" ;
CREATE POLICY platform_account_update_policy ON public."PlatformAccount" FOR UPDATE USING (dg_account = (select auth.uid ()) OR public.account_in_shared_space (id)) ;

DROP POLICY IF EXISTS platform_account_select_policy ON public."PlatformAccount" ;
CREATE POLICY platform_account_select_policy ON public."PlatformAccount" FOR SELECT USING (dg_account = (select auth.uid ()) OR public.account_in_shared_space (id)) ;

-- AgentIdentifier: Allow space members to do anything, to allow upsert
-- TODO: Maybe be more careful about privacy...

ALTER TABLE public."AgentIdentifier" ENABLE ROW LEVEL SECURITY ;

DROP POLICY IF EXISTS platform_identifier_insert_policy ON public."AgentIdentifier" ;
CREATE POLICY platform_identifier_insert_policy ON public."AgentIdentifier" FOR INSERT WITH CHECK (public.account_in_shared_space (account_id)) ;

DROP POLICY IF EXISTS platform_identifier_update_policy ON public."AgentIdentifier" ;
CREATE POLICY platform_identifier_update_policy ON public."AgentIdentifier" FOR UPDATE USING (public.account_in_shared_space (account_id)) ;

DROP POLICY IF EXISTS platform_identifier_select_policy ON public."AgentIdentifier" ;
CREATE POLICY platform_identifier_select_policy ON public."AgentIdentifier" FOR SELECT USING (public.account_in_shared_space (account_id)) ;
