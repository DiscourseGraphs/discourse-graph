ALTER TYPE public."AgentType" ADD VALUE IF NOT EXISTS 'anonymous';

CREATE OR REPLACE FUNCTION public.get_space_anonymous_email(platform public."Platform", space_id BIGINT) RETURNS character varying LANGUAGE sql IMMUTABLE AS $$
    SELECT concat(lower(platform::text), '-', space_id, '-anon@database.discoursegraphs.com')
$$;

CREATE OR REPLACE FUNCTION public.after_delete_space() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM auth.users WHERE email = public.get_space_anonymous_email(OLD.platform, OLD.id);
    DELETE FROM public."PlatformAccount"
        WHERE platform = OLD.platform
        AND account_local_id = public.get_space_anonymous_email(OLD.platform, OLD.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_delete_space_trigger AFTER DELETE ON public."Space" FOR EACH ROW EXECUTE FUNCTION public.after_delete_space();
