drop function if exists "public"."alpha_delete_by_source_local_ids"(p_space_name text, p_source_local_ids text[]);

drop function if exists "public"."alpha_get_last_update_time"(p_space_name text);

drop function if exists "public"."alpha_upsert_discourse_nodes"(p_space_name text, p_user_email text, p_user_name text, p_nodes jsonb);

drop function if exists "public"."upsert_discourse_nodes"(p_space_name text, p_user_email text, p_user_name text, p_nodes jsonb, p_platform_name text, p_platform_url text, p_space_url text, p_agent_type text, p_content_scale text, p_embedding_model text, p_document_source_id text);

drop function if exists "public"."get_nodes_needing_sync"(nodes_from_roam jsonb);
