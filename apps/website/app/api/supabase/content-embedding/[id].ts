import { NextRequest } from "next/server";
import {
  defaultOptionsHandler,
  defaultGetHandler,
  defaultDeleteHandler,
  type SegmentDataType,
} from "~/utils/supabase/apiUtils";

export const GET = async (r: NextRequest, sp: SegmentDataType) => {
  return await defaultGetHandler(r, sp, "target_id");
};

export const DELETE = async (r: NextRequest, sp: SegmentDataType) => {
  return await defaultDeleteHandler(r, sp, "target_id");
};

export const OPTIONS = defaultOptionsHandler;
