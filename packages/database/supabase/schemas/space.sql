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

CREATE OR REPLACE FUNCTION public.get_space_anonymous_email(platform public."Platform", space_id BIGINT)
RETURNS character varying IMMUTABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT concat(lower(platform::text), '-', space_id, '-anon@database.discoursegraphs.com')
$$;


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

CREATE TRIGGER on_delete_space_trigger AFTER DELETE ON public."Space" FOR EACH ROW EXECUTE FUNCTION public.after_delete_space();

-- RLS security in account file.
