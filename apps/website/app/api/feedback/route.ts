import { NextRequest, NextResponse } from "next/server";
import cors from "~/utils/llm/cors";

const LINEAR_API_URL = "https://api.linear.app/graphql";
const LINEAR_TEAM_ID = "e69757b7-976a-4567-836f-16f8a4d59df2"; // Engineering team
const LINEAR_TRIAGE_STATE_ID = "b4d95c83-3020-4f2a-9f38-5de042c66f6b"; // Triage status

type FeedbackType = "feedback" | "bugReport" | "featureRequest";

const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  feedback: "Feedback",
  bugReport: "Bug report",
  featureRequest: "Feature request",
};

type ScreenshotPayload = {
  data: string;
  mimeType: string;
  name: string;
};

type FeedbackPayload = {
  email?: string;
  title: string;
  description?: string;
  type?: FeedbackType;
  screenshot?: ScreenshotPayload;
  pluginVersion?: string;
};

const linearRequest = async <T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const res = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors?.length)
    throw new Error(json.errors[0]?.message ?? "Linear error");
  if (!json.data) throw new Error("Empty response from Linear");
  return json.data;
};

const createIssue = async (
  apiKey: string,
  title: string,
  description: string,
): Promise<{ id: string; identifier: string; url: string }> => {
  const data = await linearRequest<{
    issueCreate: {
      success: boolean;
      issue: { id: string; identifier: string; url: string };
    };
  }>(
    apiKey,
    `mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier url }
      }
    }`,
    {
      input: {
        teamId: LINEAR_TEAM_ID,
        stateId: LINEAR_TRIAGE_STATE_ID,
        title,
        description,
      },
    },
  );

  if (!data.issueCreate.success)
    throw new Error("Linear returned success=false");
  return data.issueCreate.issue;
};

type PrepareUploadParams = {
  apiKey: string;
  filename: string;
  contentType: string;
  size: number;
};

const prepareUpload = async ({
  apiKey,
  filename,
  contentType,
  size,
}: PrepareUploadParams): Promise<{
  uploadUrl: string;
  assetUrl: string;
  headers: { key: string; value: string }[];
}> => {
  const data = await linearRequest<{
    fileUpload: {
      uploadFile: {
        uploadUrl: string;
        assetUrl: string;
        headers: { key: string; value: string }[];
      };
    };
  }>(
    apiKey,
    `mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
      fileUpload(contentType: $contentType, filename: $filename, size: $size) {
        uploadFile { uploadUrl assetUrl headers { key value } }
      }
    }`,
    { contentType, filename, size },
  );
  return data.fileUpload.uploadFile;
};

type AttachToIssueParams = {
  apiKey: string;
  issueId: string;
  assetUrl: string;
  title: string;
};

const attachToIssue = async ({
  apiKey,
  issueId,
  assetUrl,
  title,
}: AttachToIssueParams): Promise<void> => {
  await linearRequest(
    apiKey,
    `mutation AttachmentCreate($input: AttachmentCreateInput!) {
      attachmentCreate(input: $input) {
        success
      }
    }`,
    { input: { issueId, url: assetUrl, title } },
  );
};

const uploadScreenshotToLinear = async (
  apiKey: string,
  issueId: string,
  screenshot: ScreenshotPayload,
): Promise<void> => {
  const buffer = Buffer.from(screenshot.data, "base64");

  const { uploadUrl, assetUrl, headers } = await prepareUpload({
    apiKey,
    filename: screenshot.name,
    contentType: screenshot.mimeType,
    size: buffer.byteLength,
  });

  const uploadHeaders = Object.fromEntries(
    headers.map(({ key, value }) => [key, value]),
  );
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": screenshot.mimeType, ...uploadHeaders },
    body: buffer,
  });

  if (!putRes.ok) throw new Error(`Screenshot upload failed: ${putRes.status}`);

  await attachToIssue({ apiKey, issueId, assetUrl, title: "Screenshot" });
};

const buildDescription = (payload: FeedbackPayload): string => {
  const parts: string[] = [];

  if (payload.email) parts.push(`**From:** ${payload.email}`);
  if (payload.type)
    parts.push(
      `**Type:** ${FEEDBACK_TYPE_LABELS[payload.type] ?? payload.type}`,
    );
  if (payload.pluginVersion)
    parts.push(`**Plugin version:** ${payload.pluginVersion}`);
  if (parts.length) parts.push("");

  if (payload.description) parts.push(payload.description, "");

  return parts.join("\n");
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) throw new Error("LINEAR_API_KEY is not configured");

    const payload = (await request.json()) as FeedbackPayload;
    if (!payload.title?.trim()) {
      return cors(
        request,
        NextResponse.json({ error: "title is required" }, { status: 400 }),
      ) as NextResponse;
    }

    const description = buildDescription(payload);
    const issue = await createIssue(apiKey, payload.title.trim(), description);

    let screenshotWarning: string | undefined;
    if (payload.screenshot) {
      try {
        await uploadScreenshotToLinear(apiKey, issue.id, payload.screenshot);
      } catch (e) {
        console.error("Screenshot upload failed after issue creation:", e);
        screenshotWarning = "Issue created but screenshot attachment failed";
      }
    }

    return cors(
      request,
      NextResponse.json(
        {
          success: true,
          issue,
          ...(screenshotWarning && { warning: screenshotWarning }),
        },
        { status: 201 },
      ),
    ) as NextResponse;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return cors(
      request,
      NextResponse.json({ error: message }, { status: 500 }),
    ) as NextResponse;
  }
};

export const OPTIONS = (request: NextRequest): NextResponse =>
  cors(request, new NextResponse(null, { status: 204 })) as NextResponse;
