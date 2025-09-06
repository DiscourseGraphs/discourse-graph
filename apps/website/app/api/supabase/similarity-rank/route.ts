import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";

type SimilarityRankInput = {
  embedding: number[];
  subsetRoamUids: string[];
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body: SimilarityRankInput = await request.json();
    const { embedding, subsetRoamUids } = body;

    if (
      !Array.isArray(embedding) ||
      !Array.isArray(subsetRoamUids) ||
      !subsetRoamUids.length
    ) {
      return createApiResponse(
        request,
        asPostgrestFailure(
          "Missing required fields: embedding and subsetRoamUids",
          "invalid",
        ),
      );
    }
    const supabase = await createClient();
    const response = await supabase.rpc("match_embeddings_for_subset_nodes", {
      p_query_embedding: JSON.stringify(embedding),
      p_subset_roam_uids: subsetRoamUids,
    });

    return createApiResponse(request, response);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/similarity-rank");
  }
};

export const OPTIONS = defaultOptionsHandler;
