import {
  defaultOptionsHandler,
  makeDefaultGetHandler,
  makeDefaultDeleteHandler,
} from "~/utils/supabase/apiUtils";

export const GET = makeDefaultGetHandler("Content");

export const OPTIONS = defaultOptionsHandler;

export const DELETE = makeDefaultDeleteHandler("Content");
