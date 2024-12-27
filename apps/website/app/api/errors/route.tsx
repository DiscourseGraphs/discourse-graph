import { Resend } from "resend";
import { NextResponse } from "next/server";
import { ErrorEmailProps } from "@repo/types";
import { EmailTemplate } from "./EmailTemplate";

const allowedOrigins = ["https://roamresearch.com", "http://localhost:3000"];

// it is there?
// eslint-disable-next-line turbo/no-undeclared-env-vars
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const isAllowedOrigin = origin && allowedOrigins.includes(origin);

    const body = await request.json();
    const {
      errorMessage,
      errorStack,
      type,
      app,
      graphName,
      context = {},
    } = body as ErrorEmailProps;

    if (!errorMessage) {
      return Response.json({ error: "Missing error message" }, { status: 400 });
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
        context,
      }),
    });

    if (resendError) {
      return Response.json({ error: resendError }, { status: 500 });
    }

    const response = NextResponse.json({ success: true, data });

    if (isAllowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    }

    return response;
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function OPTIONS(request: Request) {
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
}
