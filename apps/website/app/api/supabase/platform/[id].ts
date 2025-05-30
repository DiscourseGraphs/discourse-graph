import {
  defaultOptionsHandler,
  makeDefaultGetHandler,
  makeDefaultDeleteHandler,
} from "~/utils/supabase/apiUtils";

export const GET = makeDefaultGetHandler("Platform");

export const OPTIONS = defaultOptionsHandler;

export const DELETE = makeDefaultDeleteHandler("Platform");
