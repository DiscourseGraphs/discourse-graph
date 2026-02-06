import { NextResponse, NextRequest } from "next/server";
import {
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";

export const GET = (request: NextRequest): NextResponse => {
  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY)
      return new NextResponse("Missing variables", { status: 500 });
    return NextResponse.json(
      // eslint-disable-next-line @typescript-eslint/naming-convention
      { SUPABASE_URL, SUPABASE_ANON_KEY },
      { status: 200 },
    );
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/env");
  }
};

export const OPTIONS = defaultOptionsHandler;
