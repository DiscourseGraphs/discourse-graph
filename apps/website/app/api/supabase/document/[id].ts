import {
  defaultOptionsHandler,
  makeDefaultGetHandler,
  makeDefaultDeleteHandler,
} from "~/utils/supabase/apiUtils";

export const GET = makeDefaultGetHandler("Document");

export const OPTIONS = defaultOptionsHandler;

export const DELETE = makeDefaultDeleteHandler("Document");
