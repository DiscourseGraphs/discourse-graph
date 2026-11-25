import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { Tables } from "@repo/database/dbTypes";
import type { ColumnRow } from "@repo/database/inputTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import {
  spaceUrlFromSpaceKey,
  type NodePath,
} from "~/utils/conversion/nodeAddress";

type Space = Tables<"Space">;
type Concept = ColumnRow<"Concept">;
type Content = Tables<"Content">;

type Failure = { failure: PostgrestSingleResponse<never> };

export type FoundSpace = { space: Space; spaceKey: string };

export type FoundNode = FoundSpace & {
  nodePath: NodePath;
  concept: Concept;
  contents: Content[];
};

const notFound = (what: string): Failure => ({
  failure: asPostgrestFailure(`${what} not found`, "404", 404),
});

// Private resources are invisible under RLS, so they report as not found.
export const findSpace = async ({
  supabase,
  platform,
  spaceKey,
}: {
  supabase: DGSupabaseClient;
  platform: NodePath["platform"];
  spaceKey: string;
}): Promise<FoundSpace | Failure> => {
  const response = await supabase
    .from("Space")
    .select()
    .eq("platform", platform)
    .eq("url", spaceUrlFromSpaceKey({ platform, spaceKey }))
    .maybeSingle();
  if (response.error)
    return {
      failure: asPostgrestFailure(
        response.error.message,
        response.error.code,
        response.status,
      ),
    };
  if (!response.data) return notFound("Space");
  return { space: response.data, spaceKey };
};

export const findNode = async ({
  supabase,
  nodePath,
}: {
  supabase: DGSupabaseClient;
  nodePath: NodePath;
}): Promise<FoundNode | Failure> => {
  const spaceResult = await findSpace({ supabase, ...nodePath });
  if ("failure" in spaceResult) return spaceResult;
  const { space } = spaceResult;
  const [conceptResponse, contentResponse] = await Promise.all([
    supabase
      .from("Concept")
      .select()
      .eq("space_id", space.id)
      .eq("source_local_id", nodePath.localId)
      .maybeSingle(),
    supabase
      .from("Content")
      .select()
      .eq("space_id", space.id)
      .eq("source_local_id", nodePath.localId),
  ]);
  for (const response of [conceptResponse, contentResponse]) {
    if (response.error)
      return {
        failure: asPostgrestFailure(
          response.error.message,
          response.error.code,
          response.status,
        ),
      };
  }
  if (!conceptResponse.data) return notFound("Node");
  return {
    ...spaceResult,
    nodePath,
    concept: conceptResponse.data,
    contents: contentResponse.data ?? [],
  };
};
