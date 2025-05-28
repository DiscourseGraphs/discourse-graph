import {
  defaultOptionsHandler,
  makeDefaultGetHandler,
  makeDefaultDeleteHandler,
} from "~/utils/supabase/apiUtils";

export const GET = makeDefaultGetHandler("Space");

export const OPTIONS = defaultOptionsHandler;

export const DELETE = makeDefaultDeleteHandler("Space");
