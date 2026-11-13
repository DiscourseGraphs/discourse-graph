import { NextRequest } from "next/server";
import {
  AuthApiError,
  AuthRetryableFetchError,
  PostgrestError,
} from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import internalError from "~/utils/internalErrorSsr";
import { createBearerTokenClient } from "~/utils/supabase/server";
import { OPTIONS, POST } from "./route";

vi.mock("~/utils/supabase/server", () => ({
  createBearerTokenClient: vi.fn(),
}));
vi.mock("~/utils/internalErrorSsr", () => ({ default: vi.fn() }));

const ORIGIN = "https://roamresearch.com";
const SPACE_URL = "https://roamresearch.com/#/app/graph-a";
const URL_ROOT = "http://localhost:3000/api/internal/space";

type Result = { data: unknown; error: unknown };

const node = {
  localId: "claim-1",
  createdAt: "2026-11-13T10:00:00Z",
  authorId: "account-1",
  nodeType: "claim-type",
  coreTitle: "Sleep helps memory",
  content: { direct: { value: "CLM - Sleep helps memory" } },
};

const storedClaimType: Result = {
  data: [
    { source_local_id: "claim-type", literal_content: { label: "Claim" } },
  ],
  error: null,
};

// Resolves to a fixed result whatever filters the route chains on it.
const query = (result: Result): object => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    maybeSingle: () => builder,
    then: (
      resolve: (value: Result) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
};

const fakeClient = ({
  authError = null,
  editorSpaceIds = [5],
  stored = { data: [], error: null },
  upsert = { data: [], error: null },
}: {
  authError?: Error | null;
  editorSpaceIds?: number[];
  stored?: Result;
  upsert?: Result;
} = {}): Mock => {
  const client = {
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: authError ? null : { id: "user-1" } },
          error: authError,
        }),
    },
    rpc: vi.fn((fn: string) =>
      Promise.resolve(
        fn === "my_space_ids" ? { data: editorSpaceIds, error: null } : upsert,
      ),
    ),
    from: (table: string) =>
      query(
        table === "Space" ? { data: { url: SPACE_URL }, error: null } : stored,
      ),
  };
  vi.mocked(createBearerTokenClient).mockReturnValue(
    client as unknown as DGSupabaseClient,
  );
  return client.rpc;
};

const post = ({
  id = "5",
  token = "token-1",
  body = {},
}: {
  id?: string;
  token?: string;
  body?: string | object;
} = {}): Promise<Response> =>
  POST(
    new NextRequest(`${URL_ROOT}/${id}/graph`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

const expectResponse = async (
  response: Response,
  { status, body }: { status: number; body?: object },
): Promise<void> => {
  expect(response.status).toBe(status);
  expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  if (body !== undefined) expect(await response.json()).toMatchObject(body);
};

describe("POST /api/internal/space/[id]/graph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("refuses a space id that is not all digits", async () => {
    fakeClient();
    await expectResponse(await post({ id: "5abc" }), { status: 400 });
    expect(createBearerTokenClient).not.toHaveBeenCalled();
  });

  it("refuses a request without a bearer token", async () => {
    fakeClient();
    await expectResponse(await post({ token: "" }), {
      status: 401,
      body: { error: "Missing bearer token" },
    });
  });

  it("answers 401 when the auth server refuses the token", async () => {
    fakeClient({ authError: new AuthApiError("invalid JWT", 403, "bad_jwt") });
    await expectResponse(await post(), { status: 401 });
  });

  it("answers 502 and reports it when the auth server is unreachable", async () => {
    fakeClient({ authError: new AuthRetryableFetchError("fetch failed", 0) });
    await expectResponse(await post(), { status: 502 });
    expect(internalError).toHaveBeenCalledOnce();
  });

  it("refuses a caller who is not an editor of the space", async () => {
    fakeClient({ editorSpaceIds: [6] });
    await expectResponse(await post(), {
      status: 403,
      body: { error: "Not an editor of this space" },
    });
  });

  it("refuses a body that is not JSON", async () => {
    fakeClient();
    await expectResponse(await post({ body: "not json" }), { status: 400 });
  });

  it("refuses a body whose rid names another space, writing nothing", async () => {
    const rpc = fakeClient();
    const rid = "https://roamresearch.com/#/app/graph-b/claim-1";
    await expectResponse(await post({ body: { nodes: [{ ...node, rid }] } }), {
      status: 400,
      body: { issues: [{ path: ["nodes", 0, "rid"] }] },
    });
    expect(rpc).not.toHaveBeenCalledWith("upsert_concepts", expect.anything());
  });

  it("answers 422 for a schema in neither the body nor the space", async () => {
    const rpc = fakeClient();
    await expectResponse(await post({ body: { nodes: [node] } }), {
      status: 422,
      body: { missing: ["claim-type"] },
    });
    expect(rpc).not.toHaveBeenCalledWith("upsert_concepts", expect.anything());
  });

  it("answers 500 and reports it when the upsert fails", async () => {
    const error = new PostgrestError({
      message: "upsert failed",
      details: "",
      hint: "",
      code: "XX000",
    });
    fakeClient({ stored: storedClaimType, upsert: { data: null, error } });
    await expectResponse(await post({ body: { nodes: [node] } }), {
      status: 500,
      body: { error: "upsert failed" },
    });
    expect(internalError).toHaveBeenCalledOnce();
  });

  it("answers 200 with the id of each upserted local id", async () => {
    const rpc = fakeClient({
      stored: storedClaimType,
      upsert: { data: [42], error: null },
    });
    await expectResponse(await post({ body: { nodes: [node] } }), {
      status: 200,
      body: { upserted: { "claim-1": 42 }, failed: [] },
    });
    expect(rpc).toHaveBeenCalledWith("upsert_concepts", {
      v_space_id: 5,
      data: [expect.objectContaining({ source_local_id: "claim-1" })],
    });
  });

  it("answers 200 to an empty body after an empty upsert", async () => {
    const rpc = fakeClient();
    await expectResponse(await post(), {
      status: 200,
      body: { upserted: {}, failed: [] },
    });
    expect(rpc).toHaveBeenCalledWith("upsert_concepts", {
      v_space_id: 5,
      data: [],
    });
  });

  it("answers a CORS preflight", async () => {
    const response = await OPTIONS(
      new NextRequest(`${URL_ROOT}/5/graph`, {
        method: "OPTIONS",
        headers: { origin: ORIGIN },
      }),
    );
    await expectResponse(response, { status: 204 });
  });
});
