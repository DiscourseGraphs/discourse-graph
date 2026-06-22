import type { Json } from "@repo/database/dbTypes";
import type { LocalContentDataInput } from "@repo/database/inputTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { nextApiRoot } from "@repo/utils/execContext";

export type ContentUpsertRequest = {
  spaceId: number;
  creatorId: number;
  contentAsDocument?: boolean;
  data: LocalContentDataInput[];
};

export type ContentResolveRequestItem = {
  source_local_id: string;
  variant: "direct" | "direct_and_children" | "direct_and_description" | "full";
  content_type: string;
};

export type ContentResolveRequest = {
  spaceId: number;
  requests: ContentResolveRequestItem[];
};

export type ContentResolveRow = {
  id: number | null;
  source_local_id: string | null;
  space_id: number | null;
  text: string | null;
  created: string | null;
  last_modified: string | null;
  variant: ContentResolveRequestItem["variant"] | null;
  content_type: string | null;
  metadata: Json | null;
  author_id: number | null;
};

const getAuthorizationHeader = async (
  supabaseClient: DGSupabaseClient,
): Promise<string> => {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error(error?.message ?? "Missing Supabase session");
  }
  return `Bearer ${data.session.access_token}`;
};

const fetchJson = async <T>({
  supabaseClient,
  path,
  body,
}: {
  supabaseClient: DGSupabaseClient;
  path: string;
  body: unknown;
}): Promise<T> => {
  const authorization = await getAuthorizationHeader(supabaseClient);
  const response = await fetch(`${nextApiRoot()}${path}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Content API failed: ${response.status} ${response.statusText} ${await response.text()}`,
    );
  }

  return (await response.json()) as T;
};

export const upsertContentViaApi = async ({
  supabaseClient,
  request,
}: {
  supabaseClient: DGSupabaseClient;
  request: ContentUpsertRequest;
}): Promise<number[]> =>
  fetchJson<number[]>({
    supabaseClient,
    path: "/supabase/content/upsert",
    body: request,
  });

export const resolveContentViaApi = async ({
  supabaseClient,
  request,
}: {
  supabaseClient: DGSupabaseClient;
  request: ContentResolveRequest;
}): Promise<ContentResolveRow[]> =>
  fetchJson<ContentResolveRow[]>({
    supabaseClient,
    path: "/supabase/content/resolve",
    body: request,
  });
