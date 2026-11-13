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

-- Made ahead of public access. Space's policy shows anon no rows today.
-- create-space runs a test query on Space with the caller's key, and refuses the call if it fails.
GRANT SELECT ON TABLE public."Space" TO anon;

-- Only create-space creates spaces: it writes Space and SpaceAccess together with the service key.
-- A Space row inserted directly has no SpaceAccess, so nobody can see it, and it takes its url.
REVOKE INSERT ON TABLE public."Space" FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_space_anonymous_email(platform public."Platform", space_id BIGINT)
RETURNS character varying IMMUTABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT concat(lower(platform::text), '-', space_id, '-anon@database.discoursegraphs.com')
$$;

-- Not SECURITY DEFINER: runs as the caller.
GRANT EXECUTE ON FUNCTION public.get_space_anonymous_email TO anon;


-- on delete trigger anonymous user. Needs to be DEFINER to allow delete on user.auth.
CREATE OR REPLACE FUNCTION public.after_delete_space()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM auth.users WHERE email = public.get_space_anonymous_email(OLD.platform, OLD.id);
    DELETE FROM public."PlatformAccount"
        WHERE platform = OLD.platform
        AND account_local_id = public.get_space_anonymous_email(OLD.platform, OLD.id);
    RETURN NEW;
END;
$$;

-- Only triggers call it. Postgres checks EXECUTE on a trigger function when the trigger is created, not when it fires.
REVOKE ALL ON FUNCTION public.after_delete_space FROM authenticated;

CREATE TRIGGER on_delete_space_trigger AFTER DELETE ON public."Space" FOR EACH ROW EXECUTE FUNCTION public.after_delete_space();

-- RLS security in account file.
