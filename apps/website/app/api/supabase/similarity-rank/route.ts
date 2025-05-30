import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
  asPostgrestFailure,
} from "~/utils/supabase/apiUtils";

type SimilarityRankInput = {
  embedding: number[];
  subsetRoamUids: string[];
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body: SimilarityRankInput = await request.json();
    const { embedding, subsetRoamUids } = body;

    if (!embedding || !subsetRoamUids?.length) {
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
