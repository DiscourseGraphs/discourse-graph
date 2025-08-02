drop policy "space_access_policy" on "public"."SpaceAccess";

alter table "public"."ContentEmbedding_openai_text_embedding_3_small_1536" enable row level security;

create policy "embedding_openai_te3s_1536_policy"
on "public"."ContentEmbedding_openai_text_embedding_3_small_1536"
as permissive
for all
to public
using (content_in_space(target_id));


create policy "space_access_policy"
on "public"."SpaceAccess"
as permissive
for all
to authenticated
using (unowned_account_in_shared_space(account_id));



