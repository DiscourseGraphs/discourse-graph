REVOKE ALL ON TABLE "public"."AgentIdentifier" FROM "anon";

REVOKE ALL ON TABLE "public"."PlatformAccount" FROM "anon";

REVOKE ALL ON TABLE public."Document" FROM anon;

REVOKE ALL ON TABLE public."Content" FROM anon;

REVOKE ALL ON TABLE public."ContentEmbedding_openai_text_embedding_3_small_1536" FROM "anon" ;

REVOKE ALL ON TABLE public."Concept" FROM anon;

ALTER TABLE "public"."AgentIdentifier" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."PlatformAccount" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."Space" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."Document" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."Content" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ContentEmbedding_openai_text_embedding_3_small_1536" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."Concept" ENABLE ROW LEVEL SECURITY;

SET check_function_bodies = off;


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

ALTER FUNCTION public.after_delete_space SECURITY DEFINER;

CREATE POLICY "platform_identifier_insert_policy"
ON "public"."AgentIdentifier"
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK (account_in_shared_space(account_id));


CREATE POLICY "platform_identifier_select_policy"
ON "public"."AgentIdentifier"
AS PERMISSIVE
FOR SELECT
TO public
USING (account_in_shared_space(account_id));


CREATE POLICY "platform_identifier_update_policy"
ON "public"."AgentIdentifier"
AS PERMISSIVE
FOR UPDATE
TO public
USING (account_in_shared_space(account_id));


CREATE POLICY "platform_account_insert_policy"
ON "public"."PlatformAccount"
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK (dg_account = (select auth.uid ()) OR public.account_in_shared_space (id));


CREATE POLICY "platform_account_select_policy"
ON "public"."PlatformAccount"
AS PERMISSIVE
FOR SELECT
TO public
USING (dg_account = (select auth.uid ()) OR public.account_in_shared_space (id));


CREATE POLICY "platform_account_update_policy"
ON "public"."PlatformAccount"
AS PERMISSIVE
FOR UPDATE
TO public
USING (dg_account = (select auth.uid ()) OR public.account_in_shared_space (id));


CREATE POLICY "space_insert_policy"
ON "public"."Space"
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK (true);


CREATE POLICY "space_select_policy"
ON "public"."Space"
AS PERMISSIVE
FOR SELECT
TO public
USING (in_space(id));


CREATE POLICY "space_update_policy"
ON "public"."Space"
AS PERMISSIVE
FOR UPDATE
TO public
USING (in_space(id));

CREATE POLICY platform_account_insert_policy ON public."Document" FOR INSERT WITH CHECK (public.in_space (space_id)) ;

CREATE POLICY platform_account_update_policy ON public."Document" FOR UPDATE USING (public.in_space (space_id)) ;

CREATE POLICY platform_account_select_policy ON public."Document" FOR SELECT USING (public.in_space (space_id)) ;

CREATE POLICY platform_account_insert_policy ON public."Content" FOR INSERT WITH CHECK (public.in_space (space_id)) ;

CREATE POLICY platform_account_update_policy ON public."Content" FOR UPDATE USING (public.in_space (space_id)) ;

CREATE POLICY platform_account_select_policy ON public."Content" FOR SELECT USING (public.in_space (space_id)) ;

CREATE POLICY platform_account_insert_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536" FOR INSERT WITH CHECK (public.content_in_space(target_id)) ;

CREATE POLICY platform_account_update_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536" FOR UPDATE USING (public.content_in_space(target_id)) ;

CREATE POLICY platform_account_select_policy ON public."ContentEmbedding_openai_text_embedding_3_small_1536" FOR SELECT USING (public.content_in_space(target_id)) ;

CREATE POLICY platform_account_insert_policy ON public."Concept" FOR INSERT WITH CHECK (public.in_space(space_id));

CREATE POLICY platform_account_update_policy ON public."Concept" FOR UPDATE USING (public.in_space(space_id));

CREATE POLICY platform_account_select_policy ON public."Concept" FOR SELECT USING (public.in_space(space_id));
