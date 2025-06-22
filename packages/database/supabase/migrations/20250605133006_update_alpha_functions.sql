create or REPLACE function public.alpha_upsert_discourse_nodes(p_space_name text, p_user_email text, p_user_name text, p_nodes jsonb) returns text language plpgsql AS
$$

DECLARE
  v_platform public."Platform";
  v_space_id BIGINT;
  v_account_id BIGINT;
  v_current_time TIMESTAMP WITH TIME ZONE := now(); -- Use TIMESTAMPTZ for consistency
  v_caller_id BIGINT;
  node JSONB;
  content_row RECORD;
  v_node_metadata JSONB;

BEGIN
  -- 1. Get Space ID and its associated Platform ID
  SELECT id, platform INTO v_space_id, v_platform FROM "Space" WHERE name = p_space_name;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Space not found for name: %', p_space_name;
    -- do not go further without space id
  END IF;

  -- 2. Get Person ID (Agent ID) which should be for node creator, not author.
  -- eventually allow to pass in account_local_id instead
  SELECT account_id INTO v_caller_id FROM public."AgentIdentifier" WHERE identifier_type = 'email' AND value = p_user_email ORDER BY trusted DESC LIMIT 1;
  IF NOT FOUND THEN
    -- if not found, we may still find this in per-node data, in a later iteration.
    -- But now, we cannot insert the node without author, and we fake it with creator info.
    -- so fail if creator not found.
    RAISE EXCEPTION 'No account found for email: %', p_user_email;
  END IF;

  -- 3. Process each node: Create/Update Document, Content, and Upsert Embedding
  FOR node IN SELECT * FROM jsonb_array_elements(p_nodes)
  LOOP
    DECLARE
      v_node_uid VARCHAR := node->>'uid';
      v_node_specific_document_id BIGINT;
      v_node_text TEXT := node->>'text';
      v_node_vector VECTOR;
      v_node_created_at TIMESTAMP WITH TIME ZONE;
      v_node_last_modified_at TIMESTAMP WITH TIME ZONE;
      -- v_node_document_local_id VARCHAR := node->>'document_local_id';  we could use this instead of document_id
      -- v_node_author_local_account_id VARCHAR  := node->>'author_local_id';  we need to have this in the future
    BEGIN
      -- Attempt to parse timestamps, default to v_current_time if null or invalid
      BEGIN v_node_created_at := (NULLIF(trim(node->>'created'), ''))::TIMESTAMPTZ; EXCEPTION WHEN OTHERS THEN v_node_created_at := NULL; END;
      BEGIN v_node_last_modified_at := (NULLIF(trim(node->>'last_modified'), ''))::TIMESTAMPTZ; EXCEPTION WHEN OTHERS THEN v_node_last_modified_at := NULL; END;

      -- We should fail if creation time is not given
      v_node_created_at := COALESCE(v_node_created_at, v_current_time);
      -- We could be more lenient with modification time
      v_node_last_modified_at := COALESCE(v_node_last_modified_at, v_node_created_at);

      -- I think vectorization should be a separate process, but that's open to debate
      -- Attempt to parse vector
      BEGIN
        v_node_vector := (node->>'vector')::VECTOR;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Invalid vector format for node UID %: %', v_node_uid, node->>'vector';
        v_node_vector := NULL; -- Set to NULL if conversion fails
      END;

      -- Attempt to parse metadata, default to empty JSON object if null or invalid
      BEGIN
        v_node_metadata := (node->'metadata')::JSONB;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Invalid metadata format for node UID %, using empty JSONB. Metadata: %', v_node_uid, node->'metadata';
        v_node_metadata := '{}'::JSONB;
      END;
      v_node_metadata := COALESCE(v_node_metadata, '{}'::JSONB);

      -- future
      -- IF v_account_local_id IS NOT NULL THEN
      --   -- try to find account
      --   SELECT id INTO account_id FROM "PlatformAccount" WHERE account_local_id = v_account_local_id;
      --   IF NOT FOUND THEN
      --     INSERT INTO "PlatformAccount" (account_local_id, platform, name) VALUES (v_account_local_id, v_platform, "") RETURNING id INTO account_id;
      --   END IF;
      -- ELSE
      --   RAISE WARNING 'No local ID or caller ID for node %', v_node_uid;
      --   -- skip node
      --   CONTINUE;
      -- END


      -- this creates a document per node, which should only be done if the node is a page.
      -- As things stand, this is actually accurate, but will not remain so.
      -- That said, it should be done as an upsert.
      SELECT id INTO v_node_specific_document_id FROM "Document"
        WHERE space_id = v_space_id AND source_local_id = v_node_uid;

      IF v_node_specific_document_id IS NULL THEN
        INSERT INTO "Document" (space_id, author_id, created, last_modified, source_local_id, metadata)
        VALUES (v_space_id, v_caller_id, v_node_created_at, v_node_last_modified_at, v_node_uid, v_node_metadata)
        RETURNING id INTO v_node_specific_document_id;
      ELSE
        UPDATE "Document"
        SET last_modified = v_node_last_modified_at, metadata = v_node_metadata -- Update metadata here too
        WHERE id = v_node_specific_document_id;
      END IF;

      INSERT INTO "Content" (
          text, scale, space_id, author_id, creator_id,
          document_id, source_local_id, metadata, created, last_modified
      )
      VALUES (
          v_node_text, 'document'::"Scale", v_space_id, v_caller_id, v_caller_id,
          v_node_specific_document_id, v_node_uid, v_node_metadata,
          v_node_created_at, v_node_last_modified_at
      )
      ON CONFLICT (space_id, source_local_id) -- Assumes these are the columns in content_space_and_local_id_idx
      DO UPDATE SET
        text = EXCLUDED.text,
        scale = EXCLUDED.scale,
        author_id = EXCLUDED.author_id,
        creator_id = EXCLUDED.creator_id,
        document_id = EXCLUDED.document_id,
        metadata = EXCLUDED.metadata,
        last_modified = EXCLUDED.last_modified
      RETURNING * INTO content_row;

      -- Upsert Embedding
      IF content_row.id IS NOT NULL AND v_node_vector IS NOT NULL THEN
        INSERT INTO "ContentEmbedding_openai_text_embedding_3_small_1536" (target_id, model, vector, obsolete)
        VALUES (content_row.id, 'openai_text_embedding_3_small_1536'::"EmbeddingName", v_node_vector, false)
        ON CONFLICT (target_id) DO UPDATE
          SET vector = EXCLUDED.vector, model = EXCLUDED.model, obsolete = false;
      END IF;

    END; -- End of inner BEGIN...END for node processing
  END LOOP;

  -- 5. Update sync_info
  -- Do we want a sync info per node? In same cases yes, but if it's a global sync,
  -- We could make create a single space-scoped sync_info.
  IF jsonb_array_length(p_nodes) > 0 AND v_space_id IS NOT NULL THEN
    DECLARE
      v_task_completion_time TIMESTAMP WITH TIME ZONE := now();
      -- Use p_user_name or p_user_email for a more specific worker name
      v_resolved_worker_name TEXT := COALESCE(p_user_name, p_user_email, 'alpha_upsert_discourse_nodes_worker');
    BEGIN
      UPDATE "sync_info"
      SET last_task_end = v_task_completion_time, worker = COALESCE("sync_info".worker, v_resolved_worker_name)
      WHERE sync_target = v_space_id;

      IF NOT FOUND THEN
        INSERT INTO "sync_info" (sync_target, worker, last_task_end)
        VALUES (v_space_id, v_resolved_worker_name, v_task_completion_time);
      END IF;
    END; -- End of inner BEGIN...END for sync_info
  ELSE
    IF jsonb_array_length(p_nodes) > 0 AND v_space_id IS NULL THEN
        RAISE WARNING 'sync_info not updated because v_space_id is NULL, though p_nodes were provided.';
    END IF;
  END IF;

  RETURN 'Upsert process completed. Check warnings and notices for details.';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error in alpha_upsert_discourse_nodes: % - SQLSTATE: %', SQLERRM, SQLSTATE;
END;
$$;