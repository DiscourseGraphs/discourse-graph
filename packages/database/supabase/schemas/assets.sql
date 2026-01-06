CREATE TABLE IF NOT EXISTS public."FileReference" (
    content_id bigint NOT NULL,
    space_id bigint NOT NULL,
    filepath character varying NOT NULL,
    filehash character varying NOT NULL, -- or binary?
    "created" timestamp without time zone NOT NULL,
    last_modified timestamp without time zone NOT NULL
);
ALTER TABLE ONLY public."FileReference"
ADD CONSTRAINT "FileReference_pkey" PRIMARY KEY (content_id, filepath);

ALTER TABLE ONLY public."FileReference"
ADD CONSTRAINT "FileReference_content_id_fkey" FOREIGN KEY (
    content_id
) REFERENCES public."Content" (id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public."FileReference"
ADD CONSTRAINT "FileReference_space_id_fkey" FOREIGN KEY (
    space_id
) REFERENCES public."Space" (id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX file_reference_filepath_idx ON public."FileReference" USING btree (filepath);
CREATE INDEX file_reference_filehash_idx ON public."FileReference" USING btree (filehash);
ALTER TABLE public."FileReference" OWNER TO "postgres";

CREATE OR REPLACE VIEW public.my_file_references AS
SELECT
    content_id,
    space_id,
    filepath,
    filehash,
    created,
    last_modified
FROM public."FileReference"
WHERE (
    space_id = any(public.my_space_ids())
    OR public.can_view_specific_content(content_id)
);

GRANT ALL ON TABLE public."FileReference" TO authenticated;
GRANT ALL ON TABLE public."FileReference" TO service_role;
REVOKE ALL ON TABLE public."FileReference" FROM anon;

ALTER TABLE public."FileReference" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS file_reference_policy ON public."FileReference";
DROP POLICY IF EXISTS file_reference_select_policy ON public."FileReference";
CREATE POLICY file_reference_select_policy ON public."FileReference" FOR SELECT USING (public.in_space(space_id) OR public.can_view_specific_content(content_id));
DROP POLICY IF EXISTS file_reference_delete_policy ON public."FileReference";
CREATE POLICY file_reference_delete_policy ON public."FileReference" FOR DELETE USING (public.in_space(space_id));
DROP POLICY IF EXISTS file_reference_insert_policy ON public."FileReference";
CREATE POLICY file_reference_insert_policy ON public."FileReference" FOR INSERT WITH CHECK (public.in_space(space_id));
DROP POLICY IF EXISTS file_reference_update_policy ON public."FileReference";
CREATE POLICY file_reference_update_policy ON public."FileReference" FOR UPDATE USING (public.in_space(space_id));

-- We cannot delete blobs from sql; we'll need to call an edge function with pg_net.
-- We could pass the name to the edge function, but it's safer to accumulate paths in a table
-- so next invocation will find all collected paths.
CREATE TABLE IF NOT EXISTS public.file_gc (
    filepath character varying NOT NULL PRIMARY KEY
);
ALTER TABLE public.file_gc OWNER TO "postgres";

GRANT ALL ON TABLE public.file_gc TO service_role;
REVOKE ALL ON TABLE public.file_gc FROM authenticated;
REVOKE ALL ON TABLE public.file_gc FROM anon;

-- we could also find out if the storage exists, but not sure how that works with ACLs.
-- This is both faster and safer.
CREATE OR REPLACE FUNCTION public.file_exists(hashvalue VARCHAR) RETURNS boolean
SET search_path = ''
SECURITY DEFINER
LANGUAGE sql AS $$
SELECT EXISTS (SELECT true FROM public."FileReference" WHERE filehash = hashvalue LIMIT 1);
$$;

CREATE OR REPLACE FUNCTION public.file_access(hashvalue VARCHAR) RETURNS boolean
SET search_path = ''
SECURITY DEFINER
LANGUAGE sql AS $$
SELECT EXISTS (
    SELECT true FROM public."FileReference"
    WHERE filehash = hashvalue AND (
        public.in_space(space_id) OR
        public.can_view_specific_content(content_id)
    )
    LIMIT 1);
$$;

CREATE OR REPLACE FUNCTION public.after_delete_update_fref() RETURNS TRIGGER
SET search_path = ''
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
    IF (SELECT count(content_id) FROM public."FileReference" AS fr WHERE fr.filepath=OLD.filepath) = 0 THEN
        INSERT INTO public.file_gc VALUES (OLD.filehash);
        -- TODO: Invocation with pg_net, following the pattern in
        -- https://supabase.com/docs/guides/functions/schedule-functions
    END IF;
    IF NEW.filehash IS NOT NULL THEN
        DELETE FROM public.file_gc WHERE filepath = NEW.filehash;
    END IF;
    RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.after_insert_fref() RETURNS TRIGGER
SET search_path = ''
SECURITY DEFINER
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM public.file_gc WHERE filepath = NEW.filehash;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_delete_file_reference_trigger AFTER DELETE ON public."FileReference" FOR EACH ROW EXECUTE FUNCTION public.after_delete_update_fref();
CREATE TRIGGER on_update_file_reference_trigger AFTER UPDATE ON public."FileReference" FOR EACH ROW EXECUTE FUNCTION public.after_delete_update_fref();
CREATE TRIGGER on_insert_file_reference_trigger AFTER INSERT ON public."FileReference" FOR EACH ROW EXECUTE FUNCTION public.after_insert_fref();

INSERT INTO storage.buckets
(id, name, public)
VALUES
('assets', 'assets', true);

CREATE POLICY "storage_insert_assets_authenticated"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'assets'
);

CREATE POLICY "storage_select_assets_access"
ON storage.objects FOR SELECT TO authenticated USING (
    bucket_id = 'assets' AND file_access(name)
);

CREATE POLICY "storage_delete_assets_noref"
ON storage.objects FOR DELETE TO authenticated USING (
    bucket_id = 'assets' AND NOT EXISTS (
        SELECT true FROM public."FileReference"
        WHERE filehash = name LIMIT 1
    )
);

CREATE POLICY "storage_update_assets_authenticated"
ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'assets');
