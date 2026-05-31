import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "~/utils/supabase/proxy";

const NEGOTIATED_PATHS = new Set(["/schema/dg_base", "/schema/dg_core"]);
const ACCEPTABLE = /\b(text\/turtle|text\/\*|\*\/\*)\b/;

export const proxy = async (request: NextRequest): Promise<NextResponse> => {
  const { pathname } = request.nextUrl;

  if (NEGOTIATED_PATHS.has(pathname)) {
    const accept = request.headers.get("accept") ?? "";
    if (!ACCEPTABLE.test(accept)) {
      return new NextResponse("You have to Accept text/turtle", {
        status: 406,
        headers: { "Content-Type": "text/plain" },
      });
    }
    return NextResponse.next();
  }

  return await updateSession(request);
};

export const config = {
  matcher: ["/schema/dg_base", "/schema/dg_core", "/(auth/.*)"],
};
