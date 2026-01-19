DROP TABLE public."ConceptAccess" CASCADE;

ALTER TABLE public."ContentAccess" ADD COLUMN space_id BIGINT;
ALTER TABLE public."ContentAccess" ADD COLUMN source_local_id CHARACTER VARYING;

COMMENT ON COLUMN public."ContentAccess".space_id IS 'The space_id of the content item for which access is granted';
COMMENT ON COLUMN public."ContentAccess".source_local_id IS 'The source_local_id of the content item for which access is granted';

UPDATE public."ContentAccess" AS ca
SET space_id = ct.space_id, source_local_id = ct.source_local_id
FROM public."Content" AS ct WHERE ct.id = content_id;

ALTER TABLE public."ContentAccess" DROP COLUMN content_id CASCADE;
-- cascades to Content policies, indices, primary key...

ALTER TABLE public."ContentAccess" ALTER COLUMN space_id SET NOT NULL;
ALTER TABLE public."ContentAccess" ALTER COLUMN source_local_id SET NOT NULL;

ALTER TABLE ONLY public."ContentAccess"
ADD CONSTRAINT "ContentAccess_pkey" PRIMARY KEY (account_uid, source_local_id, space_id);

CREATE INDEX content_access_content_local_id_idx ON public."ContentAccess" (source_local_id, space_id);

CREATE OR REPLACE FUNCTION public.can_view_specific_content(space_id_ BIGINT, source_local_id_ VARCHAR) RETURNS BOOLEAN
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT EXISTS(
        SELECT true FROM public."ContentAccess"
        JOIN public.my_user_accounts() ON (account_uid=my_user_accounts)
        WHERE space_id=space_id_
        AND source_local_id = source_local_id_
        LIMIT 1);
$$;

CREATE OR REPLACE VIEW public.my_documents AS
SELECT
    id,
    space_id,
    source_local_id,
    url,
    "created",
    metadata,
    last_modified,
    author_id,
    contents
FROM public."Document" WHERE space_id = any(public.my_space_ids())
    OR public.can_view_specific_content(space_id, source_local_id);

CREATE OR REPLACE VIEW public.my_contents AS
SELECT
    id,
    document_id,
    source_local_id,
    variant,
    author_id,
    creator_id,
    created,
    text,
    metadata,
    scale,
    space_id,
    last_modified,
    part_of_id
FROM public."Content"
WHERE (
    space_id = any(public.my_space_ids())
    OR public.can_view_specific_content(space_id, source_local_id)
);

DROP POLICY IF EXISTS document_policy ON public."Document";
DROP POLICY IF EXISTS document_select_policy ON public."Document";
CREATE POLICY document_select_policy ON public."Document" FOR SELECT USING (public.in_space(space_id) OR public.can_view_specific_content(space_id, source_local_id));
DROP POLICY IF EXISTS document_delete_policy ON public."Document";
CREATE POLICY document_delete_policy ON public."Document" FOR DELETE USING (public.in_space(space_id));
DROP POLICY IF EXISTS document_insert_policy ON public."Document";
CREATE POLICY document_insert_policy ON public."Document" FOR INSERT WITH CHECK (public.in_space(space_id));
DROP POLICY IF EXISTS document_update_policy ON public."Document";
CREATE POLICY document_update_policy ON public."Document" FOR UPDATE USING (public.in_space(space_id));

DROP POLICY IF EXISTS content_select_policy ON public."Content";
CREATE POLICY content_select_policy ON public."Content" FOR SELECT USING (public.in_space(space_id) OR public.can_view_specific_content(space_id, source_local_id));

DROP POLICY IF EXISTS content_access_select_policy ON public."ContentAccess";
CREATE POLICY content_access_select_policy ON public."ContentAccess" FOR SELECT USING (public.in_space(space_id) OR public.can_access_account(account_uid));
DROP POLICY IF EXISTS content_access_delete_policy ON public."ContentAccess";
CREATE POLICY content_access_delete_policy ON public."ContentAccess" FOR DELETE USING (public.editor_in_space(space_id) OR public.can_access_account(account_uid));
DROP POLICY IF EXISTS content_access_insert_policy ON public."ContentAccess";
CREATE POLICY content_access_insert_policy ON public."ContentAccess" FOR INSERT WITH CHECK (public.editor_in_space(space_id));
DROP POLICY IF EXISTS content_access_update_policy ON public."ContentAccess";
CREATE POLICY content_access_update_policy ON public."ContentAccess" FOR UPDATE USING (public.editor_in_space(space_id));

DROP FUNCTION public.can_view_specific_content(BIGINT);

CREATE OR REPLACE VIEW public.my_concepts AS
SELECT
    id,
    epistemic_status,
    name,
    description,
    author_id,
    created,
    last_modified,
    space_id,
    arity,
    schema_id,
    literal_content,
    reference_content,
    refs,
    is_schema,
    source_local_id
FROM public."Concept"
WHERE (
    space_id = any(public.my_space_ids())
    OR public.can_view_specific_content(space_id, source_local_id)
);


DROP POLICY IF EXISTS concept_select_policy ON public."Concept";
CREATE POLICY concept_select_policy ON public."Concept" FOR SELECT USING (public.in_space(space_id) OR public.can_view_specific_content(space_id, source_local_id));

DROP FUNCTION public.can_view_specific_concept(BIGINT);

CREATE OR REPLACE FUNCTION public.is_last_local_reference(space_id_ BIGINT, source_local_id_ VARCHAR) RETURNS boolean
STABLE
SET search_path = ''
SECURITY DEFINER
LANGUAGE sql
AS $$
    SELECT NOT EXISTS (SELECT id FROM public."Content" WHERE space_id=space_id_ AND source_local_id=source_local_id_ LIMIT 1)
       AND NOT EXISTS (SELECT id FROM public."Concept" WHERE space_id=space_id_ AND source_local_id=source_local_id_)
       AND NOT EXISTS (SELECT id FROM public."Document" WHERE space_id=space_id_ AND source_local_id=source_local_id_);
$$;

CREATE OR REPLACE FUNCTION on_delete_local_reference() RETURNS TRIGGER
STABLE
SET search_path = ''
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    IF public.is_last_local_reference(OLD.space_id, OLD.source_local_id) THEN
    DELETE FROM public."ContentAccess" WHERE space_id=OLD.space_id AND source_local_id=OLD.source_local_id;
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER on_delete_content_trigger AFTER DELETE ON public."Content" FOR EACH ROW EXECUTE FUNCTION public.on_delete_local_reference();
CREATE TRIGGER on_delete_concept_trigger AFTER DELETE ON public."Concept" FOR EACH ROW EXECUTE FUNCTION public.on_delete_local_reference();
CREATE TRIGGER on_delete_document_trigger AFTER DELETE ON public."Document" FOR EACH ROW EXECUTE FUNCTION public.on_delete_local_reference();

CREATE OR REPLACE FUNCTION on_update_local_reference() RETURNS TRIGGER
STABLE
SET search_path = ''
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (OLD.space_id IS DISTINCT FROM NEW.space_id OR
        OLD.source_local_id IS DISTINCT FROM NEW.source_local_id)
    AND public.is_last_local_reference(OLD.space_id, OLD.source_local_id) THEN
        DELETE FROM public."ContentAccess" WHERE space_id=OLD.space_id AND source_local_id=OLD.source_local_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_update_content_trigger AFTER UPDATE ON public."Content" FOR EACH ROW EXECUTE FUNCTION public.on_update_local_reference();
CREATE TRIGGER on_update_concept_trigger AFTER UPDATE ON public."Concept" FOR EACH ROW EXECUTE FUNCTION public.on_update_local_reference();
CREATE TRIGGER on_update_document_trigger AFTER UPDATE ON public."Document" FOR EACH ROW EXECUTE FUNCTION public.on_update_local_reference();

CREATE OR REPLACE FUNCTION on_delete_space_revoke_local_access() RETURNS TRIGGER
STABLE
SET search_path = ''
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM public."ContentAccess" WHERE space_id=OLD.id;
    RETURN OLD;
END;
$$;

CREATE TRIGGER on_delete_space_revoke_access_trigger AFTER DELETE ON public."Space" FOR EACH ROW EXECUTE FUNCTION public.on_delete_space_revoke_local_access();
