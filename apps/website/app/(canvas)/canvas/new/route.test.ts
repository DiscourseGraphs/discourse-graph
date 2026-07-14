import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /canvas/new", () => {
  it("redirects every request to a fresh, uncached canvas", () => {
    const request = new NextRequest("https://discoursegraphs.com/canvas/new");
    const firstResponse = GET(request);
    const secondResponse = GET(request);

    expect(firstResponse.status).toBe(307);
    expect(firstResponse.headers.get("cache-control")).toBe(
      "no-store, max-age=0",
    );
    expect(firstResponse.headers.get("location")).toMatch(
      /^https:\/\/discoursegraphs\.com\/canvas\/[0-9a-f-]{36}$/,
    );
    expect(secondResponse.headers.get("location")).not.toBe(
      firstResponse.headers.get("location"),
    );
  });
});
