set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.alpha_delete_by_source_local_ids(p_space_name text, p_source_local_ids text[])
 RETURNS text
 LANGUAGE plpgsql
AS $function$-- TEST EDIT
DECLARE
  v_space_id BIGINT;
  v_deleted_documents_count INT := 0;
  v_deleted_content_count INT := 0;
  v_deleted_content_contributors_count INT := 0;
  v_updated_concepts_count INT := 0;
  v_deleted_embeddings_count INT := 0;
  v_updated_content_part_of_count INT := 0;
  v_target_document_ids BIGINT[] := '{}';
  v_all_target_content_ids BIGINT[] := '{}';
BEGIN
  -- Validate input
  IF p_space_name IS NULL OR p_space_name = '' THEN
    RETURN 'Invalid or empty space_name provided. No action taken.';
  END IF;
  
  IF p_source_local_ids IS NULL OR array_length(p_source_local_ids, 1) IS NULL THEN
    RETURN 'No source_local_ids provided or array is empty. No action taken.';
  END IF;

  -- Look up space_id from space_name
  SELECT id INTO v_space_id
  FROM "Space"
  WHERE name = p_space_name;
  
  IF v_space_id IS NULL THEN
    RETURN format('Space not found with name: %s. No action taken.', p_space_name);
  END IF;

  -- Collect IDs of Documents to be DELETED (those NOT in current p_source_local_ids)
  SELECT array_agg(id) INTO v_target_document_ids
  FROM "Document"
  WHERE space_id = v_space_id 
    AND source_local_id IS NOT NULL 
    AND NOT (source_local_id = ANY(p_source_local_ids));
  
  IF v_target_document_ids IS NULL THEN
    v_target_document_ids := '{}';
  END IF;

  -- Collect IDs of all Content to be DELETED (STALE content)
  WITH content_directly_stale AS (
    SELECT id FROM "Content"
    WHERE space_id = v_space_id 
      AND source_local_id IS NOT NULL
      AND NOT (source_local_id = ANY(p_source_local_ids))
  ), content_from_stale_documents AS (
    SELECT id FROM "Content"
    WHERE document_id = ANY(v_target_document_ids)
  ), combined_stale_content_ids AS (
    SELECT id FROM content_directly_stale
    UNION
    SELECT id FROM content_from_stale_documents
  )
  SELECT array_agg(id) INTO v_all_target_content_ids FROM combined_stale_content_ids;
  
  IF v_all_target_content_ids IS NULL THEN
    v_all_target_content_ids := '{}';
  END IF;

  -- Proceed with deletions/updates only if there is content to target
  IF array_length(v_all_target_content_ids, 1) > 0 THEN
    -- Step 1.1: Clean up 'content_contributors' table
    WITH deleted_contributors AS (
      DELETE FROM "content_contributors"
      WHERE content_id = ANY(v_all_target_content_ids)
      RETURNING content_id
    )
    SELECT count(*) INTO v_deleted_content_contributors_count FROM deleted_contributors;

    -- Step 1.2: Clean up 'Concept' table
    WITH updated_concepts AS (
      UPDATE "Concept"
      SET represented_by_id = NULL
      WHERE represented_by_id = ANY(v_all_target_content_ids)
      RETURNING id
    )
    SELECT count(*) INTO v_updated_concepts_count FROM updated_concepts;

    -- Step 1.3: Clean up 'ContentEmbedding' table
    WITH deleted_embeddings AS (
      DELETE FROM "ContentEmbedding_openai_text_embedding_3_small_1536"
      WHERE target_id = ANY(v_all_target_content_ids)
      RETURNING target_id
    )
    SELECT count(*) INTO v_deleted_embeddings_count FROM deleted_embeddings;

    -- Step 1.4: Clean up 'Content' table's self-references
    WITH updated_content_parts AS (
      UPDATE "Content"
      SET part_of_id = NULL
      WHERE part_of_id = ANY(v_all_target_content_ids)
        AND NOT (id = ANY(v_all_target_content_ids))
      RETURNING id
    )
    SELECT count(*) INTO v_updated_content_part_of_count FROM updated_content_parts;

    -- Step 2: Delete the target 'Content' items
    WITH deleted_main_content AS (
      DELETE FROM "Content"
      WHERE id = ANY(v_all_target_content_ids)
      RETURNING id
    )
    SELECT count(*) INTO v_deleted_content_count FROM deleted_main_content;
  END IF;

  -- Proceed with Document deletions only if there are documents to target
  IF array_length(v_target_document_ids, 1) > 0 THEN
    -- Step 3: Delete the target 'Document' items
    WITH deleted_docs AS (
      DELETE FROM "Document"
      WHERE id = ANY(v_target_document_ids)
      RETURNING id
    )
    SELECT count(*) INTO v_deleted_documents_count FROM deleted_docs;
  END IF;

  -- Return summary
  RETURN format(
    'Operation completed for space "%s" (ID: %s). Documents deleted: %s. Content items deleted: %s. Content contributors removed: %s. Concepts (represented_by_id) updated: %s. Content (part_of_id links) updated: %s. Embeddings deleted: %s.',
    p_space_name,
    v_space_id,
    v_deleted_documents_count,
    v_deleted_content_count,
    v_deleted_content_contributors_count,
    v_updated_concepts_count,
    v_updated_content_part_of_count,
    v_deleted_embeddings_count
  );
END;$function$
;

CREATE OR REPLACE FUNCTION public.alpha_get_last_update_time(p_space_name text)
 RETURNS TABLE(last_update_time timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    sync.last_task_end
  FROM
    "sync_info" AS sync
  JOIN
    "Space" AS sp ON sync.sync_target = sp.id
  WHERE
    sp.name = p_space_name;
END;
$function$
;


CREATE OR REPLACE FUNCTION public.upsert_discourse_nodes(p_space_name text, p_user_email text, p_user_name text, p_nodes jsonb, p_platform_name text DEFAULT 'roamresearch'::text, p_platform_url text DEFAULT 'https://roamresearch.com'::text, p_space_url text DEFAULT NULL::text, p_agent_type text DEFAULT 'Person'::text, p_content_scale text DEFAULT 'chunk_unit'::text, p_embedding_model text DEFAULT 'openai_text_embedding_3_small_1536'::text, p_document_source_id text DEFAULT NULL::text)
 RETURNS TABLE(content_id bigint, embedding_created boolean, action text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_platform_id bigint;
  v_space_id bigint;
  v_person_id bigint;
  v_agent_id bigint;
  v_document_id bigint;
  v_current_time timestamp;
  v_document_source_local_id text;
  v_space_url text;
  node jsonb;
  content_row record;
  embedding_exists boolean;
BEGIN
  v_current_time := now();
  
  RAISE NOTICE 'Starting upsert_discourse_nodes for space: %, user: %, nodes count: %', 
    p_space_name, p_user_email, jsonb_array_length(p_nodes);
  
  -- Set space URL if not provided
  v_space_url := COALESCE(p_space_url, p_platform_url || '/#/app/' || p_space_name);
  
  -- Set default document source ID if not provided
  v_document_source_local_id := COALESCE(
    p_document_source_id, 
    'discourse_nodes_document_for_' || p_space_name
  );

  RAISE NOTICE 'Space URL: %, Document source ID: %', v_space_url, v_document_source_local_id;

  -- Get or create Platform
  INSERT INTO "Platform" (name, url)
  VALUES (p_platform_name, p_platform_url)
  ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name;
  
  SELECT id INTO v_platform_id 
  FROM "Platform" 
  WHERE url = p_platform_url;

  RAISE NOTICE 'Platform ID: %', v_platform_id;

  -- Get or create Space
  INSERT INTO "Space" (name, url, platform_id)
  VALUES (p_space_name, v_space_url, v_platform_id)
  ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name;
  
  SELECT id INTO v_space_id 
  FROM "Space" 
  WHERE url = v_space_url;

  RAISE NOTICE 'Space ID: %', v_space_id;

  -- Get or create Person/Agent (handle the inheritance relationship properly)
  -- First check if Person exists
  SELECT id INTO v_person_id 
  FROM "Person" 
  WHERE email = p_user_email;
  
  IF v_person_id IS NULL THEN
    RAISE NOTICE 'Creating new Person for email: %', p_user_email;
    -- Create new Agent first
    INSERT INTO "Agent" (type)
    VALUES (p_agent_type::public."EntityType")
    RETURNING id INTO v_agent_id;
    
    -- Create Person with the Agent ID
    INSERT INTO "Person" (id, name, email)
    VALUES (v_agent_id, p_user_name, p_user_email);
    
    v_person_id := v_agent_id;
    RAISE NOTICE 'Created new Person with ID: %', v_person_id;
  ELSE
    RAISE NOTICE 'Found existing Person with ID: %', v_person_id;
    -- Update existing Person
    UPDATE "Person" 
    SET name = p_user_name
    WHERE id = v_person_id;
  END IF;

  -- Get or create Document for discourse nodes
  RAISE NOTICE 'Looking for existing document with space_id=%', v_space_id;
  
  -- Debug: Show what documents exist for this space
  RAISE NOTICE 'Existing documents for space_id=%: %', v_space_id, (
    SELECT string_agg(
      'id=' || id::text || ' source_local_id=' || COALESCE(source_local_id, 'NULL'), 
      ', '
    )
    FROM "Document" 
    WHERE space_id = v_space_id
  );
  
  SELECT id INTO v_document_id 
  FROM "Document" 
  WHERE space_id = v_space_id
  LIMIT 1;
    
  IF v_document_id IS NULL THEN
    RAISE NOTICE 'Creating new Document for space_id: %', v_space_id;
    INSERT INTO "Document" (
      space_id, 
      author_id, 
      created, 
      last_modified, 
      source_local_id
    )
    VALUES (
      v_space_id,
      v_person_id,
      v_current_time,
      v_current_time,
      v_document_source_local_id
    )
    RETURNING id INTO v_document_id;
  ELSE
    RAISE NOTICE 'Found existing Document with ID: %', v_document_id;
    -- Don't update last_modified here - we'll do it at the end after successful processing
  END IF;

  RAISE NOTICE 'Document ID: %', v_document_id;

  -- Process each node
  FOR node IN SELECT * FROM jsonb_array_elements(p_nodes)
  LOOP
    RAISE NOTICE 'Processing node with UID: %', node->>'uid';
    
    -- Check if content exists
    SELECT * INTO content_row
    FROM "Content"
    WHERE space_id = v_space_id 
      AND source_local_id = node->>'uid';
    
    IF content_row.id IS NULL THEN
      RAISE NOTICE 'Creating new Content for UID: %', node->>'uid';
      -- Create new content
      INSERT INTO "Content" (
        text, 
        scale, 
        space_id, 
        author_id, 
        creator_id,
        document_id, 
        source_local_id, 
        metadata, 
        created, 
        last_modified
      ) VALUES (
        node->>'text',
        p_content_scale::"Scale",
        v_space_id,
        v_person_id,
        v_person_id,
        v_document_id,
        node->>'uid',
        node->'metadata',
        (node->>'created')::timestamp,
        (node->>'last_modified')::timestamp
      )
      RETURNING * INTO content_row;
    ELSE
      RAISE NOTICE 'Updating existing Content with ID: %', content_row.id;
      -- Update existing content
      UPDATE "Content" 
      SET
        text = node->>'text',
        last_modified = (node->>'last_modified')::timestamp,
        metadata = node->'metadata',
        scale = p_content_scale::"Scale"
      WHERE id = content_row.id
      RETURNING * INTO content_row;
    END IF;

    RAISE NOTICE 'Content created/updated with ID: %', content_row.id;

    -- Check if embedding exists
    SELECT EXISTS(
      SELECT 1 FROM "ContentEmbedding_openai_text_embedding_3_small_1536" 
      WHERE target_id = content_row.id
    ) INTO embedding_exists;

    RAISE NOTICE 'Embedding exists: %, Vector length: %', embedding_exists, 
      array_length(string_to_array(trim(both '[]' from node->>'vector'), ','), 1);

    -- Upsert embedding
    INSERT INTO "ContentEmbedding_openai_text_embedding_3_small_1536" (target_id, model, vector, obsolete)
    VALUES (
      content_row.id,
      p_embedding_model::"EmbeddingName",
      (node->>'vector')::vector,
      false
    )
    ON CONFLICT (target_id) 
    DO UPDATE SET
      vector = EXCLUDED.vector,
      model = EXCLUDED.model,
      obsolete = false;

    RAISE NOTICE 'Embedding upserted for content ID: %', content_row.id;

    RETURN QUERY SELECT 
      content_row.id, 
      true,
      CASE WHEN embedding_exists THEN 'updated' ELSE 'created' END;
  END LOOP;
  
  -- Update last_modified for the document
  RAISE NOTICE 'Updating document last_modified from % to %', 
    (SELECT last_modified FROM "Document" WHERE id = v_document_id),
    v_current_time;
    
  UPDATE "Document" 
  SET last_modified = v_current_time
  WHERE id = v_document_id;
  
  RAISE NOTICE 'Document updated. New last_modified: %', 
    (SELECT last_modified FROM "Document" WHERE id = v_document_id);

  RAISE NOTICE 'Completed upsert_discourse_nodes successfully';
END;
$function$
;


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
