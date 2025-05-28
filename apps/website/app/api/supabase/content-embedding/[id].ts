import { NextRequest } from "next/server";
import {
  defaultOptionsHandler,
  makeDefaultGetHandler,
  makeDefaultDeleteHandler,
  type SegmentDataType,
} from "~/utils/supabase/apiUtils";

// TODO: Make model agnostic

export const GET = makeDefaultGetHandler(
  "ContentEmbedding_openai_text_embedding_3_small_1536",
  "targetId",
);

export const DELETE = makeDefaultDeleteHandler(
  "ContentEmbedding_openai_text_embedding_3_small_1536",
  "targetId",
);

export const OPTIONS = defaultOptionsHandler;
