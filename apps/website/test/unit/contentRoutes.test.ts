import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contentTypes } from "@repo/content-model";
import { createRequestSupabaseClient } from "~/utils/supabase/request";
import { POST as resolveContent } from "~/api/internal/space/[id]/content/resolve/route";
import { POST as upsertContent } from "~/api/internal/space/[id]/content/upsert/route";

vi.mock("~/utils/supabase/request", () => ({
  createRequestSupabaseClient: vi.fn(),
}));

const mockedCreateRequestSupabaseClient = vi.mocked(
  createRequestSupabaseClient,
);

const createJsonRequest = (body: unknown): NextRequest =>
  new NextRequest("http://localhost:3000/api/internal/space/42/content", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Origin: "app://obsidian.md",
    },
    method: "POST",
  });

describe("content representation routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves only explicitly requested representations", async () => {
    const inQuery = vi.fn().mockResolvedValue({
      data: [
        {
          author_id: 7,
          content_type: contentTypes.discourseGraphAtJson,
          created: "2026-08-30T00:00:00",
          last_modified: "2026-08-30T00:00:00",
          metadata: { content: { version: 1 } },
          source_local_id: "claim-1",
          text: "Canonical plain text",
          variant: "full",
        },
        {
          author_id: 7,
          content_type: contentTypes.markdown,
          created: "2026-08-30T00:00:00",
          last_modified: "2026-08-30T00:00:00",
          metadata: {},
          source_local_id: "claim-1",
          text: "# Native Markdown",
          variant: "full",
        },
      ],
      error: null,
      status: 200,
    });
    mockedCreateRequestSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ in: inQuery }),
        }),
      }),
    } as never);

    const response = await resolveContent(
      createJsonRequest({
        representations: [
          {
            contentType: contentTypes.discourseGraphAtJson,
            variant: "full",
          },
        ],
        sourceLocalIds: ["claim-1"],
      }),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "app://obsidian.md",
    );
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({
        contentType: contentTypes.discourseGraphAtJson,
        sourceLocalId: "claim-1",
        text: "Canonical plain text",
      }),
    ]);
  });

  it("forwards validated content to the authenticated upsert RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [101, 102],
      error: null,
      status: 200,
    });
    const from = vi.fn().mockImplementation((table: string) => {
      if (table === "PlatformAccount") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ id: 7 }], error: null }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { account_id: 7 },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    });
    mockedCreateRequestSupabaseClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "dg-user-1" } },
          error: null,
        }),
      },
      from,
      rpc,
    } as never);
    const content = [
      {
        content_type: contentTypes.plainText,
        source_local_id: "claim-1",
        text: "Semantic text",
        variant: "direct",
      },
    ];

    const response = await upsertContent(
      createJsonRequest({ content, contentAsDocument: false }),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ids: [101, 102] });
    expect(rpc).toHaveBeenCalledWith("upsert_content", {
      content_as_document: false,
      data: content,
      v_creator_id: 7,
      v_space_id: 42,
    });
  });

  it("rejects malformed requests before creating a database client", async () => {
    const response = await resolveContent(
      createJsonRequest({ representations: [], sourceLocalIds: ["claim-1"] }),
      { params: Promise.resolve({ id: "42" }) },
    );

    expect(response.status).toBe(400);
    expect(mockedCreateRequestSupabaseClient).not.toHaveBeenCalled();
  });
});
