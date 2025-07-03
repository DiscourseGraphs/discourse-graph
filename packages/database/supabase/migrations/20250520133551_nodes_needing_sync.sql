CREATE OR REPLACE FUNCTION public.get_nodes_needing_sync(nodes_from_roam jsonb)
 RETURNS TABLE(uid_to_sync text)
 LANGUAGE plpgsql
AS $function$
    DECLARE
        node_info jsonb;
        roam_node_uid TEXT;
        roam_node_edit_epoch_ms BIGINT;
        content_db_last_modified_epoch_ms BIGINT;
    BEGIN
        FOR node_info IN SELECT * FROM jsonb_array_elements(nodes_from_roam)
        LOOP
            roam_node_uid := (node_info->>'uid')::text;
            roam_node_edit_epoch_ms := (node_info->>'roam_edit_time')::bigint;

            -- Get the last_modified time from your Content table for the current node, converting it to epoch milliseconds
            -- Assumes your 'last_modified' column in 'Content' is a timestamp type
            SELECT EXTRACT(EPOCH FROM c.last_modified) * 1000
            INTO content_db_last_modified_epoch_ms
            FROM public."Content" c -- Ensure "Content" matches your table name exactly (case-sensitive if quoted)
            WHERE c.source_local_id = roam_node_uid;

            IF NOT FOUND THEN
                -- Node does not exist in Supabase Content table, so it needs sync
                uid_to_sync := roam_node_uid;
                RETURN NEXT;
            ELSE
                -- Node exists, compare timestamps
                IF roam_node_edit_epoch_ms > content_db_last_modified_epoch_ms THEN
                    uid_to_sync := roam_node_uid;
                    RETURN NEXT;
                END IF;
            END IF;
        END LOOP;
        RETURN;
    END;
    $function$;
