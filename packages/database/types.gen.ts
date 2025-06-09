export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      "access-token": {
        Row: {
          "access-token": string;
          code: string | null;
          created_date: string;
          id: number;
          state: string | null;
        };
        Insert: {
          "access-token": string;
          code?: string | null;
          created_date?: string;
          id?: never;
          state?: string | null;
        };
        Update: {
          "access-token"?: string;
          code?: string | null;
          created_date?: string;
          id?: never;
          state?: string | null;
        };
        Relationships: [];
      };
      AgentIdentifier: {
        Row: {
          account_id: number;
          identifier_type: Database["public"]["Enums"]["AgentIdentifierType"];
          trusted: boolean;
          value: string;
        };
        Insert: {
          account_id: number;
          identifier_type: Database["public"]["Enums"]["AgentIdentifierType"];
          trusted?: boolean;
          value: string;
        };
        Update: {
          account_id?: number;
          identifier_type?: Database["public"]["Enums"]["AgentIdentifierType"];
          trusted?: boolean;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "AgentIdentifier_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "PlatformAccount";
            referencedColumns: ["id"];
          },
        ];
      };
      Concept: {
        Row: {
          arity: number;
          author_id: number | null;
          content: Json;
          created: string;
          description: string | null;
          epistemic_status: Database["public"]["Enums"]["EpistemicStatus"];
          id: number;
          is_schema: boolean;
          last_modified: string;
          name: string;
          represented_by_id: number | null;
          schema_id: number | null;
          space_id: number;
        };
        Insert: {
          arity?: number;
          author_id?: number | null;
          content?: Json;
          created: string;
          description?: string | null;
          epistemic_status?: Database["public"]["Enums"]["EpistemicStatus"];
          id?: number;
          is_schema?: boolean;
          last_modified: string;
          name: string;
          represented_by_id?: number | null;
          schema_id?: number | null;
          space_id: number;
        };
        Update: {
          arity?: number;
          author_id?: number | null;
          content?: Json;
          created?: string;
          description?: string | null;
          epistemic_status?: Database["public"]["Enums"]["EpistemicStatus"];
          id?: number;
          is_schema?: boolean;
          last_modified?: string;
          name?: string;
          represented_by_id?: number | null;
          schema_id?: number | null;
          space_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "Concept_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "PlatformAccount";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Concept_represented_by_id_fkey";
            columns: ["represented_by_id"];
            isOneToOne: false;
            referencedRelation: "Content";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Concept_schema_id_fkey";
            columns: ["schema_id"];
            isOneToOne: false;
            referencedRelation: "Concept";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Concept_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "Space";
            referencedColumns: ["id"];
          },
        ];
      };
      concept_contributors: {
        Row: {
          concept_id: number;
          contributor_id: number;
        };
        Insert: {
          concept_id: number;
          contributor_id: number;
        };
        Update: {
          concept_id?: number;
          contributor_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "concept_contributors_concept_id_fkey";
            columns: ["concept_id"];
            isOneToOne: false;
            referencedRelation: "Concept";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "concept_contributors_contributor_id_fkey";
            columns: ["contributor_id"];
            isOneToOne: false;
            referencedRelation: "PlatformAccount";
            referencedColumns: ["id"];
          },
        ];
      };
      Content: {
        Row: {
          author_id: number | null;
          created: string;
          creator_id: number | null;
          document_id: number;
          id: number;
          last_modified: string;
          metadata: Json;
          part_of_id: number | null;
          scale: Database["public"]["Enums"]["Scale"];
          source_local_id: string | null;
          space_id: number | null;
          text: string;
        };
        Insert: {
          author_id?: number | null;
          created: string;
          creator_id?: number | null;
          document_id: number;
          id?: number;
          last_modified: string;
          metadata?: Json;
          part_of_id?: number | null;
          scale: Database["public"]["Enums"]["Scale"];
          source_local_id?: string | null;
          space_id?: number | null;
          text: string;
        };
        Update: {
          author_id?: number | null;
          created?: string;
          creator_id?: number | null;
          document_id?: number;
          id?: number;
          last_modified?: string;
          metadata?: Json;
          part_of_id?: number | null;
          scale?: Database["public"]["Enums"]["Scale"];
          source_local_id?: string | null;
          space_id?: number | null;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "Content_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "PlatformAccount";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Content_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "PlatformAccount";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Content_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "Document";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Content_part_of_id_fkey";
            columns: ["part_of_id"];
            isOneToOne: false;
            referencedRelation: "Content";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Content_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "Space";
            referencedColumns: ["id"];
          },
        ];
      };
      content_contributors: {
        Row: {
          content_id: number;
          contributor_id: number;
        };
        Insert: {
          content_id: number;
          contributor_id: number;
        };
        Update: {
          content_id?: number;
          contributor_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "content_contributors_content_id_fkey";
            columns: ["content_id"];
            isOneToOne: false;
            referencedRelation: "Content";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_contributors_contributor_id_fkey";
            columns: ["contributor_id"];
            isOneToOne: false;
            referencedRelation: "PlatformAccount";
            referencedColumns: ["id"];
          },
        ];
      };
      ContentEmbedding_openai_text_embedding_3_small_1536: {
        Row: {
          model: Database["public"]["Enums"]["EmbeddingName"];
          obsolete: boolean | null;
          target_id: number;
          vector: string;
        };
        Insert: {
          model?: Database["public"]["Enums"]["EmbeddingName"];
          obsolete?: boolean | null;
          target_id: number;
          vector: string;
        };
        Update: {
          model?: Database["public"]["Enums"]["EmbeddingName"];
          obsolete?: boolean | null;
          target_id?: number;
          vector?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ContentEmbedding_openai_text_embedding_3_small_1_target_id_fkey";
            columns: ["target_id"];
            isOneToOne: true;
            referencedRelation: "Content";
            referencedColumns: ["id"];
          },
        ];
      };
      Document: {
        Row: {
          author_id: number;
          contents: unknown | null;
          created: string;
          id: number;
          last_modified: string;
          metadata: Json;
          source_local_id: string | null;
          space_id: number | null;
          url: string | null;
        };
        Insert: {
          author_id: number;
          contents?: unknown | null;
          created: string;
          id?: number;
          last_modified: string;
          metadata?: Json;
          source_local_id?: string | null;
          space_id?: number | null;
          url?: string | null;
        };
        Update: {
          author_id?: number;
          contents?: unknown | null;
          created?: string;
          id?: number;
          last_modified?: string;
          metadata?: Json;
          source_local_id?: string | null;
          space_id?: number | null;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "Document_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "PlatformAccount";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "Document_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "Space";
            referencedColumns: ["id"];
          },
        ];
      };
      PlatformAccount: {
        Row: {
          account_local_id: string;
          active: boolean;
          agent_type: Database["public"]["Enums"]["AgentType"];
          dg_account: string | null;
          id: number;
          metadata: Json;
          name: string;
          platform: Database["public"]["Enums"]["Platform"];
          write_permission: boolean;
        };
        Insert: {
          account_local_id: string;
          active?: boolean;
          agent_type?: Database["public"]["Enums"]["AgentType"];
          dg_account?: string | null;
          id?: number;
          metadata?: Json;
          name: string;
          platform: Database["public"]["Enums"]["Platform"];
          write_permission?: boolean;
        };
        Update: {
          account_local_id?: string;
          active?: boolean;
          agent_type?: Database["public"]["Enums"]["AgentType"];
          dg_account?: string | null;
          id?: number;
          metadata?: Json;
          name?: string;
          platform?: Database["public"]["Enums"]["Platform"];
          write_permission?: boolean;
        };
        Relationships: [];
      };
      Space: {
        Row: {
          id: number;
          name: string;
          platform: Database["public"]["Enums"]["Platform"];
          url: string;
        };
        Insert: {
          id?: number;
          name: string;
          platform: Database["public"]["Enums"]["Platform"];
          url: string;
        };
        Update: {
          id?: number;
          name?: string;
          platform?: Database["public"]["Enums"]["Platform"];
          url?: string;
        };
        Relationships: [];
      };
      SpaceAccess: {
        Row: {
          account_id: number;
          editor: boolean;
          space_id: number;
        };
        Insert: {
          account_id: number;
          editor: boolean;
          space_id: number;
        };
        Update: {
          account_id?: number;
          editor?: boolean;
          space_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "SpaceAccess_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "PlatformAccount";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "SpaceAccess_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "Space";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_info: {
        Row: {
          failure_count: number | null;
          id: number;
          last_task_end: string | null;
          last_task_start: string | null;
          status: Database["public"]["Enums"]["task_status"] | null;
          sync_function: string | null;
          sync_target: number | null;
          task_times_out_at: string | null;
          worker: string;
        };
        Insert: {
          failure_count?: number | null;
          id?: number;
          last_task_end?: string | null;
          last_task_start?: string | null;
          status?: Database["public"]["Enums"]["task_status"] | null;
          sync_function?: string | null;
          sync_target?: number | null;
          task_times_out_at?: string | null;
          worker: string;
        };
        Update: {
          failure_count?: number | null;
          id?: number;
          last_task_end?: string | null;
          last_task_start?: string | null;
          status?: Database["public"]["Enums"]["task_status"] | null;
          sync_function?: string | null;
          sync_target?: number | null;
          task_times_out_at?: string | null;
          worker?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      end_sync_task: {
        Args: {
          s_target: number;
          s_function: string;
          s_worker: string;
          s_status: Database["public"]["Enums"]["task_status"];
        };
        Returns: undefined;
      };
      get_nodes_needing_sync: {
        Args: { nodes_from_roam: Json };
        Returns: {
          uid_to_sync: string;
        }[];
      };
      match_content_embeddings: {
        Args: {
          query_embedding: string;
          match_threshold: number;
          match_count: number;
          current_document_id?: number;
        };
        Returns: {
          content_id: number;
          roam_uid: string;
          text_content: string;
          similarity: number;
        }[];
      };
      match_embeddings_for_subset_nodes: {
        Args: { p_query_embedding: string; p_subset_roam_uids: string[] };
        Returns: {
          content_id: number;
          roam_uid: string;
          text_content: string;
          similarity: number;
        }[];
      };
      propose_sync_task: {
        Args: {
          s_target: number;
          s_function: string;
          s_worker: string;
          timeout: unknown;
          task_interval: unknown;
        };
        Returns: unknown;
      };
    };
    Enums: {
      AgentIdentifierType: "email" | "orcid";
      AgentType: "person" | "organization" | "automated_agent";
      EmbeddingName:
        | "openai_text_embedding_ada2_1536"
        | "openai_text_embedding_3_small_512"
        | "openai_text_embedding_3_small_1536"
        | "openai_text_embedding_3_large_256"
        | "openai_text_embedding_3_large_1024"
        | "openai_text_embedding_3_large_3072";
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
        | "Occurrence";
      EpistemicStatus:
        | "certainly_not"
        | "strong_evidence_against"
        | "could_be_false"
        | "unknown"
        | "uncertain"
        | "contentious"
        | "could_be_true"
        | "strong_evidence_for"
        | "certain";
      Platform: "Roam" | "Obsidian";
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
        | "phrase";
      task_status: "active" | "timeout" | "complete" | "failed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      AgentIdentifierType: ["email", "orcid"],
      AgentType: ["person", "organization", "automated_agent"],
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
} as const;
