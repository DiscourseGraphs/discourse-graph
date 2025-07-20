REVOKE ALL ON TABLE public."AgentIdentifier" FROM "anon";

REVOKE ALL ON TABLE public."PlatformAccount" FROM "anon";

REVOKE ALL ON TABLE public."Document" FROM anon;

REVOKE ALL ON TABLE public."Content" FROM anon;

REVOKE ALL ON TABLE public."ContentEmbedding_openai_text_embedding_3_small_1536" FROM "anon" ;

REVOKE ALL ON TABLE public."Concept" FROM anon;

ALTER TABLE public."AgentIdentifier" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."PlatformAccount" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."Space" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."SpaceAccess" ENABLE ROW LEVEL SECURITY ;

ALTER TABLE public."Document" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."Content" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."ContentEmbedding_openai_text_embedding_3_small_1536" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."Concept" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_contributors ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.concept_contributors ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sync_info ENABLE ROW LEVEL SECURITY ;

ALTER TABLE public.access_token ENABLE ROW LEVEL SECURITY ;

-- SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.my_account(account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT dg_account = auth.uid() FROM public."PlatformAccount" WHERE id=account_id;
$$;

COMMENT ON FUNCTION public.my_account IS 'security utility: is this my own account?' ;

CREATE OR REPLACE FUNCTION public.account_in_shared_space(p_account_id bigint)
RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $function$
    SELECT COUNT(*) > 0 FROM public."PlatformAccount" AS my_account
        JOIN public."SpaceAccess" AS my_access ON (my_account.id=my_access.account_id)
        JOIN public."SpaceAccess" AS their_access ON (their_access.space_id = my_access.space_id AND their_access.account_id=p_account_id)
        WHERE my_account.dg_account = auth.uid();
$function$
;

COMMENT ON FUNCTION public.account_in_shared_space IS 'security utility: does current user share a space with this account?' ;

CREATE OR REPLACE FUNCTION public.in_space(space_id bigint)
RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql
AS $function$
    SELECT COUNT(*) > 0 FROM public."SpaceAccess" AS sa
        JOIN public."PlatformAccount" AS pa ON (pa.id=sa.account_id)
        WHERE sa.space_id = $1 AND pa.dg_account = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.unowned_account_in_shared_space (p_account_id BIGINT) RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT COUNT(*) > 0 FROM public."PlatformAccount" AS my_account
        JOIN public."SpaceAccess" AS my_access ON (my_account.id=my_access.account_id)
        JOIN public."SpaceAccess" AS their_access ON (their_access.space_id = my_access.space_id AND their_access.account_id=p_account_id)
        JOIN public."PlatformAccount" AS their_account ON (their_access.account_id = their_account.id AND their_account.id=p_account_id)
        WHERE my_account.dg_account = auth.uid() AND COALESCE(their_account.dg_account, auth.uid()) = auth.uid();
$$ ;

COMMENT ON FUNCTION public.unowned_account_in_shared_space IS 'security utility: does current user share a space with this account? And is this an un-owned account (other than mine)?' ;

COMMENT ON FUNCTION public.in_space IS 'security utility: does current user have access to this space?' ;

CREATE OR REPLACE FUNCTION public.content_in_space (content_id BIGINT) RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $function$
    SELECT public.in_space(space_id) FROM public."Content" WHERE id=content_id
$function$
;

COMMENT ON FUNCTION public.content_in_space IS 'security utility: does current user have access to this content''s space?' ;

CREATE OR REPLACE FUNCTION public.concept_in_space (concept_id BIGINT) RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.in_space(space_id) FROM public."Concept" WHERE id=concept_id
$$;

COMMENT ON FUNCTION public.concept_in_space IS 'security utility: does current user have access to this concept''s space?';

CREATE OR REPLACE FUNCTION public.document_in_space (document_id BIGINT) RETURNS boolean
STABLE
SET search_path = ''
LANGUAGE sql
AS $$
    SELECT public.in_space(space_id) FROM public."Document" WHERE id=document_id
$$;

COMMENT ON FUNCTION public.document_in_space IS 'security utility: does current user have access to this document''s space?';


CREATE OR REPLACE FUNCTION public.generic_entity_access (target_id BIGINT, target_type public."EntityType") RETURNS boolean
STABLE SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    SELECT CASE
        WHEN target_type = 'Space' THEN public.in_space(target_id)
        WHEN target_type = 'Content' THEN public.content_in_space(target_id)
        WHEN target_type = 'Concept' THEN public.concept_in_space(target_id)
        WHEN target_type = 'Document' THEN public.document_in_space(target_id)
        WHEN target_type = 'PlatformAccount' THEN public.account_in_shared_space(target_id)
        ELSE false
    END;
$$ ;

COMMENT ON FUNCTION public.generic_entity_access IS 'security utility: does current user have access to this generic entity?' ;

ALTER FUNCTION public.after_delete_space SECURITY DEFINER;


CREATE POLICY platform_account_policy ON public."PlatformAccount" FOR ALL USING (dg_account = (select auth.uid ()) OR (dg_account IS NULL AND public.unowned_account_in_shared_space (id))) ;
CREATE POLICY platform_account_select_policy ON public."PlatformAccount" FOR SELECT USING (dg_account = (select auth.uid ()) OR public.account_in_shared_space (id)) ;

CREATE POLICY space_policy ON public."Space" FOR ALL USING (in_space(id));
CREATE POLICY space_insert_policy ON public."Space" FOR INSERT WITH CHECK (true) ;

CREATE POLICY space_access_policy ON public."SpaceAccess" FOR ALL USING (public.unowned_account_in_shared_space(account_id)) ;
CREATE POLICY space_access_select_policy ON public."SpaceAccess" FOR ALL USING (public.in_space (space_id)) ;

CREATE POLICY agent_identifier_policy ON public."AgentIdentifier" FOR ALL USING (public.unowned_account_in_shared_space (account_id)) ;
CREATE POLICY agent_identifier_select_policy ON public."AgentIdentifier" FOR SELECT USING (public.account_in_shared_space (account_id)) ;

CREATE POLICY document_policy ON public."Document" FOR ALL USING (public.in_space (space_id)) ;

CREATE POLICY content_policy ON public."Content" FOR ALL USING (public.in_space (space_id)) ;

CREATE POLICY embedding_openai_te3s_1536_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536" FOR ALL USING (public.content_in_space(target_id)) ;

CREATE POLICY concept_policy ON public."Concept" FOR ALL USING (public.in_space(space_id));

CREATE POLICY concept_contributors_policy ON public.concept_contributors FOR ALL USING (public.concept_in_space(concept_id));

CREATE POLICY content_contributors_policy ON public.content_contributors FOR ALL USING (public.content_in_space(content_id));

CREATE POLICY sync_info_policy ON public.sync_info FOR ALL USING (public.generic_entity_access (sync_target, target_type)) ;

CREATE POLICY access_token_policy ON public.access_token FOR ALL USING (public.my_account(platform_account_id)) ;
