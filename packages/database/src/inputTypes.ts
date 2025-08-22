import type { Database, TablesInsert } from "@repo/database/dbTypes";

export type LocalDocumentDataInput = Partial<
  Omit<Database['public']["CompositeTypes"]["document_local_input"], "author_inline">
  & { author_inline: Partial<TablesInsert<"PlatformAccount">> }>;
export type LocalContentDataInput = Partial<
  Omit<Database['public']["CompositeTypes"]["content_local_input"], "document_inline" | "author_inline" | "creator_inline">
  & {
    document_inline: LocalDocumentDataInput,
    author_inline: Partial<TablesInsert<"PlatformAccount">>,
    creator_inline: Partial<TablesInsert<"PlatformAccount">>
  }>;
export type LocalConceptDataInput = Partial<Database['public']["CompositeTypes"]["concept_local_input"]>;
