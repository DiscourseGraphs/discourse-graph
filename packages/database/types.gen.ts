export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      access_token: {
        Row: {
          access_token: string
          code: string | null
          created_date: string
          platform_account_id: number | null
          request_id: string
        }
        Insert: {
          access_token: string
          code?: string | null
          created_date?: string
          platform_account_id?: number | null
          request_id: string
        }
        Update: {
          access_token?: string
          code?: string | null
          created_date?: string
          platform_account_id?: number | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_token_platform_account_id_fkey"
            columns: ["platform_account_id"]
            isOneToOne: false
            referencedRelation: "PlatformAccount"
            referencedColumns: ["id"]
          },
        ]
      }
      AgentIdentifier: {
        Row: {
          account_id: number
          identifier_type: Database["public"]["Enums"]["AgentIdentifierType"]
          trusted: boolean
          value: string
        }
        Insert: {
          account_id: number
          identifier_type: Database["public"]["Enums"]["AgentIdentifierType"]
          trusted?: boolean
          value: string
        }
        Update: {
          account_id?: number
          identifier_type?: Database["public"]["Enums"]["AgentIdentifierType"]
          trusted?: boolean
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "AgentIdentifier_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "PlatformAccount"
            referencedColumns: ["id"]
          },
        ]
      }
      Concept: {
        Row: {
          arity: number | null
          author_id: number | null
          created: string
          description: string | null
          epistemic_status: Database["public"]["Enums"]["EpistemicStatus"]
          id: number
          is_schema: boolean
          last_modified: string
          literal_content: Json
          name: string
          reference_content: Json
          refs: number[]
          represented_by_id: number | null
          schema_id: number | null
          space_id: number
        }
        Insert: {
          arity?: number | null
          author_id?: number | null
          created: string
          description?: string | null
          epistemic_status?: Database["public"]["Enums"]["EpistemicStatus"]
          id?: number
          is_schema?: boolean
          last_modified: string
          literal_content?: Json
          name: string
          reference_content?: Json
          refs?: number[]
          represented_by_id?: number | null
          schema_id?: number | null
          space_id: number
        }
        Update: {
          arity?: number | null
          author_id?: number | null
          created?: string
          description?: string | null
          epistemic_status?: Database["public"]["Enums"]["EpistemicStatus"]
          id?: number
          is_schema?: boolean
          last_modified?: string
          literal_content?: Json
          name?: string
          reference_content?: Json
          refs?: number[]
          represented_by_id?: number | null
          schema_id?: number | null
          space_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "Concept_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "PlatformAccount"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Concept_represented_by_id_fkey"
            columns: ["represented_by_id"]
            isOneToOne: false
            referencedRelation: "Content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Concept_schema_id_fkey"
            columns: ["schema_id"]
            isOneToOne: false
            referencedRelation: "Concept"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Concept_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "Space"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_contributors: {
        Row: {
          concept_id: number
          contributor_id: number
        }
        Insert: {
          concept_id: number
          contributor_id: number
        }
        Update: {
          concept_id?: number
          contributor_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "concept_contributors_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "Concept"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_contributors_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "PlatformAccount"
            referencedColumns: ["id"]
          },
        ]
      }
      Content: {
        Row: {
          author_id: number | null
          created: string
          creator_id: number | null
          document_id: number
          id: number
          last_modified: string
          metadata: Json
          part_of_id: number | null
          scale: Database["public"]["Enums"]["Scale"]
          source_local_id: string | null
          space_id: number | null
          text: string
          variant: Database["public"]["Enums"]["ContentVariant"]
        }
        Insert: {
          author_id?: number | null
          created: string
          creator_id?: number | null
          document_id: number
          id?: number
          last_modified: string
          metadata?: Json
          part_of_id?: number | null
          scale: Database["public"]["Enums"]["Scale"]
          source_local_id?: string | null
          space_id?: number | null
          text: string
          variant?: Database["public"]["Enums"]["ContentVariant"]
        }
        Update: {
          author_id?: number | null
          created?: string
          creator_id?: number | null
          document_id?: number
          id?: number
          last_modified?: string
          metadata?: Json
          part_of_id?: number | null
          scale?: Database["public"]["Enums"]["Scale"]
          source_local_id?: string | null
          space_id?: number | null
          text?: string
          variant?: Database["public"]["Enums"]["ContentVariant"]
        }
        Relationships: [
          {
            foreignKeyName: "Content_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "PlatformAccount"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Content_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "PlatformAccount"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Content_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "Document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Content_part_of_id_fkey"
            columns: ["part_of_id"]
            isOneToOne: false
            referencedRelation: "Content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Content_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "Space"
            referencedColumns: ["id"]
          },
        ]
      }
      content_contributors: {
        Row: {
          content_id: number
          contributor_id: number
        }
        Insert: {
          content_id: number
          contributor_id: number
        }
        Update: {
          content_id?: number
          contributor_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_contributors_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "Content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_contributors_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "PlatformAccount"
            referencedColumns: ["id"]
          },
        ]
      }
      ContentEmbedding_openai_text_embedding_3_small_1536: {
        Row: {
          model: Database["public"]["Enums"]["EmbeddingName"]
          obsolete: boolean | null
          target_id: number
          vector: string
        }
        Insert: {
          model?: Database["public"]["Enums"]["EmbeddingName"]
          obsolete?: boolean | null
          target_id: number
          vector: string
        }
        Update: {
          model?: Database["public"]["Enums"]["EmbeddingName"]
          obsolete?: boolean | null
          target_id?: number
          vector?: string
        }
        Relationships: [
          {
            foreignKeyName: "ContentEmbedding_openai_text_embedding_3_small_1_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: true
            referencedRelation: "Content"
            referencedColumns: ["id"]
          },
        ]
      }
      Document: {
        Row: {
          author_id: number
          contents: unknown | null
          created: string
          id: number
          last_modified: string
          metadata: Json
          source_local_id: string | null
          space_id: number | null
          url: string | null
        }
        Insert: {
          author_id: number
          contents?: unknown | null
          created: string
          id?: number
          last_modified: string
          metadata?: Json
          source_local_id?: string | null
          space_id?: number | null
          url?: string | null
        }
        Update: {
          author_id?: number
          contents?: unknown | null
          created?: string
          id?: number
          last_modified?: string
          metadata?: Json
          source_local_id?: string | null
          space_id?: number | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Document_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "PlatformAccount"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Document_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "Space"
            referencedColumns: ["id"]
          },
        ]
      }
      PlatformAccount: {
        Row: {
          account_local_id: string
          active: boolean
          agent_type: Database["public"]["Enums"]["AgentType"]
          dg_account: string | null
          id: number
          metadata: Json
          name: string
          platform: Database["public"]["Enums"]["Platform"]
          write_permission: boolean
        }
        Insert: {
          account_local_id: string
          active?: boolean
          agent_type?: Database["public"]["Enums"]["AgentType"]
          dg_account?: string | null
          id?: number
          metadata?: Json
          name: string
          platform: Database["public"]["Enums"]["Platform"]
          write_permission?: boolean
        }
        Update: {
          account_local_id?: string
          active?: boolean
          agent_type?: Database["public"]["Enums"]["AgentType"]
          dg_account?: string | null
          id?: number
          metadata?: Json
          name?: string
          platform?: Database["public"]["Enums"]["Platform"]
          write_permission?: boolean
        }
        Relationships: []
      }
      Space: {
        Row: {
          id: number
          name: string
          platform: Database["public"]["Enums"]["Platform"]
          url: string
        }
        Insert: {
          id?: number
          name: string
          platform: Database["public"]["Enums"]["Platform"]
          url: string
        }
        Update: {
          id?: number
          name?: string
          platform?: Database["public"]["Enums"]["Platform"]
          url?: string
        }
        Relationships: []
      }
      SpaceAccess: {
        Row: {
          account_id: number
          editor: boolean
          space_id: number
        }
        Insert: {
          account_id: number
          editor: boolean
          space_id: number
        }
        Update: {
          account_id?: number
          editor?: boolean
          space_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "SpaceAccess_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "PlatformAccount"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "SpaceAccess_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "Space"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_info: {
        Row: {
          failure_count: number | null
          id: number
          last_task_end: string | null
          last_task_start: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          sync_function: string | null
          sync_target: number | null
          target_type: Database["public"]["Enums"]["EntityType"]
          task_times_out_at: string | null
          worker: string
        }
        Insert: {
          failure_count?: number | null
          id?: number
          last_task_end?: string | null
          last_task_start?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          sync_function?: string | null
          sync_target?: number | null
          target_type?: Database["public"]["Enums"]["EntityType"]
          task_times_out_at?: string | null
          worker: string
        }
        Update: {
          failure_count?: number | null
          id?: number
          last_task_end?: string | null
          last_task_start?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          sync_function?: string | null
          sync_target?: number | null
          target_type?: Database["public"]["Enums"]["EntityType"]
          task_times_out_at?: string | null
          worker?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _local_concept_to_db_concept: {
        Args: {
          data: Database["public"]["CompositeTypes"]["concept_local_input"]
        }
        Returns: {
          arity: number | null
          author_id: number | null
          created: string
          description: string | null
          epistemic_status: Database["public"]["Enums"]["EpistemicStatus"]
          id: number
          is_schema: boolean
          last_modified: string
          literal_content: Json
          name: string
          reference_content: Json
          refs: number[]
          represented_by_id: number | null
          schema_id: number | null
          space_id: number
        }
      }
      _local_content_to_db_content: {
        Args: {
          data: Database["public"]["CompositeTypes"]["content_local_input"]
        }
        Returns: {
          author_id: number | null
          created: string
          creator_id: number | null
          document_id: number
          id: number
          last_modified: string
          metadata: Json
          part_of_id: number | null
          scale: Database["public"]["Enums"]["Scale"]
          source_local_id: string | null
          space_id: number | null
          text: string
          variant: Database["public"]["Enums"]["ContentVariant"]
        }
      }
      _local_document_to_db_document: {
        Args: {
          data: Database["public"]["CompositeTypes"]["document_local_input"]
        }
        Returns: {
          author_id: number
          contents: unknown | null
          created: string
          id: number
          last_modified: string
          metadata: Json
          source_local_id: string | null
          space_id: number | null
          url: string | null
        }
      }
      account_in_shared_space: {
        Args: { p_account_id: number }
        Returns: boolean
      }
      alpha_delete_by_source_local_ids: {
        Args: { p_source_local_ids: string[]; p_space_name: string }
        Returns: string
      }
      alpha_get_last_update_time: {
        Args: { p_space_name: string }
        Returns: {
          last_update_time: string
        }[]
      }
      alpha_upsert_discourse_nodes: {
        Args: {
          p_user_name: string
          p_nodes: Json
          p_space_name: string
          p_user_email: string
        }
        Returns: string
      }
      compute_arity_local: {
        Args: { lit_content: Json; schema_id: number }
        Returns: number
      }
      concept_in_space: {
        Args: { concept_id: number }
        Returns: boolean
      }
      content_in_space: {
        Args: { content_id: number }
        Returns: boolean
      }
      create_account_in_space: {
        Args: {
          space_id_: number
          account_local_id_: string
          name_: string
          email_?: string
          email_trusted?: boolean
          editor_?: boolean
        }
        Returns: number
      }
      document_in_space: {
        Args: { document_id: number }
        Returns: boolean
      }
      end_sync_task: {
        Args: {
          s_worker: string
          s_status: Database["public"]["Enums"]["task_status"]
          s_function: string
          s_target: number
        }
        Returns: undefined
      }
      extract_references: {
        Args: { refs: Json }
        Returns: number[]
      }
      generic_entity_access: {
        Args: {
          target_type: Database["public"]["Enums"]["EntityType"]
          target_id: number
        }
        Returns: boolean
      }
      get_nodes_needing_sync: {
        Args: { nodes_from_roam: Json }
        Returns: {
          uid_to_sync: string
        }[]
      }
      get_space_anonymous_email: {
        Args: {
          platform: Database["public"]["Enums"]["Platform"]
          space_id: number
        }
        Returns: string
      }
      in_space: {
        Args: { space_id: number }
        Returns: boolean
      }
      match_content_embeddings: {
        Args: {
          current_document_id?: number
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          text_content: string
          similarity: number
          roam_uid: string
          content_id: number
        }[]
      }
      match_embeddings_for_subset_nodes: {
        Args: { p_subset_roam_uids: string[]; p_query_embedding: string }
        Returns: {
          similarity: number
          text_content: string
          roam_uid: string
          content_id: number
        }[]
      }
      my_account: {
        Args: { account_id: number }
        Returns: boolean
      }
      propose_sync_task: {
        Args: {
          s_function: string
          s_target: number
          task_interval: unknown
          timeout: unknown
          s_worker: string
        }
        Returns: string
      }
      unowned_account_in_shared_space: {
        Args: { p_account_id: number }
        Returns: boolean
      }
      upsert_concepts: {
        Args: { data: Json; v_space_id: number }
        Returns: number[]
      }
      upsert_content: {
        Args: {
          v_space_id: number
          v_creator_id: number
          content_as_document?: boolean
          data: Json
        }
        Returns: number[]
      }
      upsert_content_embedding: {
        Args: { content_id: number; embedding_array: number[]; model: string }
        Returns: undefined
      }
      upsert_discourse_nodes: {
        Args: {
          p_space_name: string
          p_user_email: string
          p_user_name: string
          p_nodes: Json
          p_platform_name?: string
          p_platform_url?: string
          p_space_url?: string
          p_agent_type?: string
          p_content_scale?: string
          p_embedding_model?: string
          p_document_source_id?: string
        }
        Returns: {
          action: string
          content_id: number
          embedding_created: boolean
        }[]
      }
      upsert_documents: {
        Args: { v_space_id: number; data: Json }
        Returns: number[]
      }
    }
    Enums: {
      AgentIdentifierType: "email" | "orcid"
      AgentType: "person" | "organization" | "automated_agent" | "anonymous"
      ContentVariant:
        | "direct"
        | "direct_and_children"
        | "direct_and_description"
      EmbeddingName:
        | "openai_text_embedding_ada2_1536"
        | "openai_text_embedding_3_small_512"
        | "openai_text_embedding_3_small_1536"
        | "openai_text_embedding_3_large_256"
        | "openai_text_embedding_3_large_1024"
        | "openai_text_embedding_3_large_3072"
      EntityType:
        | "Platform"
        | "Space"
        | "PlatformAccount"
        | "Person"
        | "AutomatedAgent"
        | "Document"
        | "Content"
        | "Concept"
        | "ConceptSchema"
        | "ContentLink"
        | "Occurrence"
      EpistemicStatus:
        | "certainly_not"
        | "strong_evidence_against"
        | "could_be_false"
        | "unknown"
        | "uncertain"
        | "contentious"
        | "could_be_true"
        | "strong_evidence_for"
        | "certain"
      Platform: "Roam" | "Obsidian"
      Scale:
        | "document"
        | "post"
        | "chunk_unit"
        | "section"
        | "block"
        | "field"
        | "paragraph"
        | "quote"
        | "sentence"
        | "phrase"
      task_status: "active" | "timeout" | "complete" | "failed"
    }
    CompositeTypes: {
      concept_local_input: {
        epistemic_status: Database["public"]["Enums"]["EpistemicStatus"] | null
        name: string | null
        description: string | null
        author_id: number | null
        created: string | null
        last_modified: string | null
        space_id: number | null
        schema_id: number | null
        literal_content: Json | null
        is_schema: boolean | null
        represented_by_id: number | null
        reference_content: Json | null
        author_local_id: string | null
        represented_by_local_id: string | null
        schema_represented_by_local_id: string | null
        space_url: string | null
        local_reference_content: Json | null
      }
      content_local_input: {
        document_id: number | null
        source_local_id: string | null
        author_id: number | null
        creator_id: number | null
        created: string | null
        text: string | null
        metadata: Json | null
        scale: Database["public"]["Enums"]["Scale"] | null
        space_id: number | null
        last_modified: string | null
        part_of_id: number | null
        document_local_id: string | null
        creator_local_id: string | null
        author_local_id: string | null
        part_of_local_id: string | null
        space_url: string | null
        document_inline:
          | Database["public"]["CompositeTypes"]["document_local_input"]
          | null
        author_inline:
          | Database["public"]["Tables"]["PlatformAccount"]["Row"]
          | null
        creator_inline:
          | Database["public"]["Tables"]["PlatformAccount"]["Row"]
          | null
        embedding_inline:
          | Database["public"]["CompositeTypes"]["inline_embedding_input"]
          | null
        variant: Database["public"]["Enums"]["ContentVariant"] | null
      }
      document_local_input: {
        space_id: number | null
        source_local_id: string | null
        url: string | null
        created: string | null
        metadata: Json | null
        last_modified: string | null
        author_id: number | null
        contents: unknown | null
        author_local_id: string | null
        space_url: string | null
        author_inline:
          | Database["public"]["Tables"]["PlatformAccount"]["Row"]
          | null
      }
      inline_embedding_input: {
        model: string | null
        vector: number[] | null
      }
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      AgentIdentifierType: ["email", "orcid"],
      AgentType: ["person", "organization", "automated_agent", "anonymous"],
      ContentVariant: [
        "direct",
        "direct_and_children",
        "direct_and_description",
      ],
      EmbeddingName: [
        "openai_text_embedding_ada2_1536",
        "openai_text_embedding_3_small_512",
        "openai_text_embedding_3_small_1536",
        "openai_text_embedding_3_large_256",
        "openai_text_embedding_3_large_1024",
        "openai_text_embedding_3_large_3072",
      ],
      EntityType: [
        "Platform",
        "Space",
        "PlatformAccount",
        "Person",
        "AutomatedAgent",
        "Document",
        "Content",
        "Concept",
        "ConceptSchema",
        "ContentLink",
        "Occurrence",
      ],
      EpistemicStatus: [
        "certainly_not",
        "strong_evidence_against",
        "could_be_false",
        "unknown",
        "uncertain",
        "contentious",
        "could_be_true",
        "strong_evidence_for",
        "certain",
      ],
      Platform: ["Roam", "Obsidian"],
      Scale: [
        "document",
        "post",
        "chunk_unit",
        "section",
        "block",
        "field",
        "paragraph",
        "quote",
        "sentence",
        "phrase",
      ],
      task_status: ["active", "timeout", "complete", "failed"],
    },
  },
} as const

