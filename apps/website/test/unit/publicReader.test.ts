import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DisplayPage from "../../app/(display)/id/[id]/page";
import { loadDisplayNode } from "../../app/(display)/id/[id]/loadDisplayNode";

vi.mock("@repo/database/dbDotEnv", () => ({
  envContents: () => ({
    SUPABASE_URL: "https://demo.example.org",
    SUPABASE_PUBLISHABLE_KEY: "demo-public-key",
  }),
}));

const rid =
  "orn:obsidian.note:837541d3a06d1871/01a11c80-23b2-7f8c-aa7e-516a7807a014";

afterEach(() => vi.unstubAllGlobals());

describe("public reader", () => {
  it("renders the selected node without exposing vault properties", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const rows = url.pathname.endsWith("/Space")
        ? [{ id: 1, platform: "Obsidian", name: "Planning vault" }]
        : url.pathname.endsWith("/Content")
          ? [
              { variant: "direct", text: "CLM - Test claim 20261008" },
              {
                variant: "full",
                text: "---\ninternal: hidden\n---\nAccording to planning vault",
              },
            ]
          : url.searchParams.has("source_local_id")
            ? [{ schema_id: 2, is_schema: false, is_relation: false }]
            : [{ name: "Claim", literal_content: {} }];
      return Response.json(rows);
    });
    const html = renderToStaticMarkup(
      await DisplayPage({
        params: Promise.resolve({ id: encodeURIComponent(rid) }),
      }),
    );
    expect(html).toContain("CLM - Test claim 20261008");
    expect(html).toContain("Claim · Planning vault");
    expect(html).toContain("<p>According to planning vault</p>");
    expect(html).not.toContain("hidden");
  });

  it("returns unavailable for an unrecognized resource ID", async () => {
    expect(await loadDisplayNode("urn:other:example")).toBeUndefined();
  });

  it("does not render a node invisible to the public client", async () => {
    vi.stubGlobal("fetch", async () => Response.json([]));
    expect(await loadDisplayNode(rid)).toBeUndefined();
  });
});
