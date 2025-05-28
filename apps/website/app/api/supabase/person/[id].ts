import {
  defaultOptionsHandler,
  makeDefaultGetHandler,
  makeDefaultDeleteHandler,
} from "~/utils/supabase/apiUtils";

export const GET = makeDefaultGetHandler("Person");

export const OPTIONS = defaultOptionsHandler;

export const DELETE = makeDefaultDeleteHandler("Person");
