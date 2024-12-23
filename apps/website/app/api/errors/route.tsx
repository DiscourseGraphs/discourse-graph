import React from "react";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { ErrorEmailProps } from "@repo/types";

const allowedOrigins = ["https://roamresearch.com", "http://localhost:3000"];

// TODO: use react.email
export const EmailTemplate = ({
  errorMessage,
  errorStack,
  type,
  app,
  graphName,
  context,
}: ErrorEmailProps) => {
  return (
    <div>
      <h1>Error Report</h1>

      <h2>Type: {type}</h2>
      <h2>App: {app}</h2>
      <h2>Graph Name: {graphName}</h2>

      <div>
        <h2>Error Details</h2>
        <div>{errorMessage}</div>
      </div>

      {context != null && Object.keys(context).length > 0 && (
        <div>
          <h2>Additional Data</h2>
          <pre>{JSON.stringify(context, null, 2)}</pre>
        </div>
      )}

      {errorStack && (
        <div>
          <h2>Stack Trace</h2>
          <pre>{errorStack}</pre>
        </div>
      )}
    </div>
  );
};

// it is there?
// eslint-disable-next-line turbo/no-undeclared-env-vars
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    // Add CORS headers
    const origin = request.headers.get("origin");
    const isAllowedOrigin = origin && allowedOrigins.includes(origin);

    // Handle the request
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

    // Create response with data and add CORS headers
    const response = NextResponse.json({ success: true, data });

    // Set CORS headers
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

// Add OPTIONS handler for preflight requests
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
