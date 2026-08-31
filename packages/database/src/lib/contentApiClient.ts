import { nextApiRoot } from "@repo/utils/execContext";

import type {
  ContentResolveRequest,
  ContentUpsertRequest,
  ContentUpsertResponse,
  ResolvedContent,
} from "@repo/database/contentApi";
import type { DGSupabaseClient } from "@repo/database/lib/client";

const getAccessToken = async ({
  client,
}: {
  client: DGSupabaseClient;
}): Promise<string> => {
  const { data, error } = await client.auth.getSession();
  const accessToken = data.session?.access_token;
  if (error !== null || accessToken === undefined) {
    throw new Error(error?.message ?? "An authenticated session is required.");
  }
  return accessToken;
};

const requestContentApi = async <T>({
  client,
  path,
  body,
}: {
  client: DGSupabaseClient;
  path: string;
  body: unknown;
}): Promise<T> => {
  const accessToken = await getAccessToken({ client });
  const response = await fetch(`${nextApiRoot()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Content API failed (${response.status} ${response.statusText}): ${details}`,
    );
  }
  return (await response.json()) as T;
};

export const resolveContentThroughApi = async ({
  client,
  spaceId,
  request,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  request: ContentResolveRequest;
}): Promise<ResolvedContent[]> =>
  requestContentApi<ResolvedContent[]>({
    client,
    path: `/internal/space/${spaceId}/content/resolve`,
    body: request,
  });

export const upsertContentThroughApi = async ({
  client,
  spaceId,
  request,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  request: ContentUpsertRequest;
}): Promise<ContentUpsertResponse> =>
  requestContentApi<ContentUpsertResponse>({
    client,
    path: `/internal/space/${spaceId}/content/upsert`,
    body: request,
  });
