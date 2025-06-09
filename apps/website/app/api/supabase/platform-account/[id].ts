import {
  defaultOptionsHandler,
  makeDefaultGetHandler,
  makeDefaultDeleteHandler,
} from "~/utils/supabase/apiUtils";

export const GET = makeDefaultGetHandler("PlatformAccount");

export const OPTIONS = defaultOptionsHandler;

export const DELETE = makeDefaultDeleteHandler("PlatformAccount");
