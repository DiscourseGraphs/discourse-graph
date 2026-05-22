import { type NextRequest } from "next/server";
import { updateSession } from "~/utils/supabase/proxy";

export const proxy = async (request: NextRequest) =>
  await updateSession(request);

export const config = {
  matcher: [
    /* Only apply to /auth paths */
    "/(auth/.*)",
  ],
};
