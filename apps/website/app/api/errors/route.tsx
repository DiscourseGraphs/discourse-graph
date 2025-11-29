import { Resend } from "resend";
import { NextResponse } from "next/server";
import { ErrorEmailProps } from "@repo/types";
import { EmailTemplate } from "./EmailTemplate";

const allowedOrigins = ["https://roamresearch.com", "http://localhost:3000"];

const resend = new Resend(process.env.RESEND_API_KEY);

const createCorsResponse = (
  data: unknown,
  status: number,
  origin: string | null,
): Response => {
  const response = NextResponse.json(data, { status });
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);

  if (isAllowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  }

  return response;
};

export const POST = async (request: Request) => {
  const origin = request.headers.get("origin");

  try {
    const body = (await request.json()) as ErrorEmailProps;
    const {
      errorMessage,
      errorStack,
      type,
      app,
      graphName,
      username,
      version,
      buildDate,
      context = {},
    } = body;

    if (!errorMessage) {
      return createCorsResponse(
        { error: "Missing error message" },
        400,
        origin,
      );
    }

    const { data, error: resendError } = await resend.emails.send({
      from: "Discourse Graphs <errors@discoursegraphs.com>",
      // to: ["discoursegraphs+errors@gmail.com"],
      to: ["mclicks@gmail.com"],
      subject: `Roam Error: ${type}`,
      react: EmailTemplate({
        errorMessage,
        errorStack,
        type,
        app,
        graphName,
        // ?: Why is username assignment unsafe and graphName,version,buildDate are not?
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        username,
        version,
        buildDate,
        context,
      }),
    });

    if (resendError) {
      return createCorsResponse({ error: resendError }, 500, origin);
    }

    return createCorsResponse({ success: true, data }, 200, origin);
  } catch (error) {
    return createCorsResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
      origin,
    );
  }
};

export const OPTIONS = (request: Request) => {
  const origin = request.headers.get("origin");

  const isAllowedOrigin = origin && allowedOrigins.includes(origin);

  const response = new NextResponse(null, {
    status: 204,
  });

  if (isAllowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  }

  return response;
};
