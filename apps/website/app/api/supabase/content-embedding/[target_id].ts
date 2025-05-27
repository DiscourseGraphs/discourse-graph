import { NextRequest } from "next/server";
import {
  defaultOptionsHandler,
  defaultGetHandler,
  defaultDeleteHandler,
} from "~/utils/supabase/apiUtils";

export const GET = async (r: NextRequest) => {
  return await defaultGetHandler(r, "target_id");
};

export const DELETE = async (r: NextRequest) => {
  return await defaultDeleteHandler(r, "target_id");
};

export const OPTIONS = defaultOptionsHandler;
