import { describe, it, expect } from "vitest";
import {
  nodeContentUrl,
  nodeDataUrl,
  nodeIri,
  nodePathFromRid,
  platformFromSegment,
  ridFromNodePath,
  spaceDataUrl,
  spaceKeyFromSpaceUrl,
  spacePathFromSpaceUrl,
  spaceUrlFromSpaceKey,
} from "../../app/utils/conversion/nodeAddress";

const ORIGIN = "https://discoursegraphs.com";
const roamPath = {
  platform: "Roam" as const,
  spaceKey: "akamatsulab",
  localId: "abc123XYZ",
};
const obsidianPath = {
  platform: "Obsidian" as const,
  spaceKey: "837541d3a06d1871",
  localId: "f00d-1234",
};

describe("space keys", () => {
  it("takes the Roam graph name from the space URL", () => {
    expect(
      spaceKeyFromSpaceUrl({
        platform: "Roam",
        spaceUrl: "https://roamresearch.com/#/app/akamatsulab",
      }),
    ).toBe("akamatsulab");
  });

  it("takes the Obsidian vault ID from the space URL", () => {
    expect(
      spaceKeyFromSpaceUrl({
        platform: "Obsidian",
        spaceUrl: "obsidian:837541d3a06d1871",
      }),
    ).toBe("837541d3a06d1871");
  });

  it("rejects a space URL of another platform or with extra segments", () => {
    expect(
      spaceKeyFromSpaceUrl({
        platform: "Roam",
        spaceUrl: "obsidian:837541d3a06d1871",
      }),
    ).toBeUndefined();
    expect(
      spaceKeyFromSpaceUrl({
        platform: "Roam",
        spaceUrl: "https://roamresearch.com/#/app/graph/extra",
      }),
    ).toBeUndefined();
    expect(
      spaceKeyFromSpaceUrl({
        platform: "Roam",
        spaceUrl: "https://roamresearch.com/#/app/",
      }),
    ).toBeUndefined();
  });

  it("rebuilds the space URL from the key", () => {
    expect(spaceUrlFromSpaceKey(roamPath)).toBe(
      "https://roamresearch.com/#/app/akamatsulab",
    );
    expect(spaceUrlFromSpaceKey(obsidianPath)).toBe(
      "obsidian:837541d3a06d1871",
    );
  });

  it("finds the platform and key of a space URL", () => {
    expect(
      spacePathFromSpaceUrl("https://roamresearch.com/#/app/akamatsulab"),
    ).toEqual({ platform: "Roam", spaceKey: "akamatsulab" });
    expect(spacePathFromSpaceUrl("obsidian:837541d3a06d1871")).toEqual({
      platform: "Obsidian",
      spaceKey: "837541d3a06d1871",
    });
    expect(spacePathFromSpaceUrl("https://example.com/space")).toBeUndefined();
  });

  it("maps platform segments to platforms", () => {
    expect(platformFromSegment("roam")).toBe("Roam");
    expect(platformFromSegment("obsidian")).toBe("Obsidian");
    expect(platformFromSegment("Roam")).toBeUndefined();
  });
});

describe("RIDs and node paths", () => {
  it("round-trips a Roam RID", () => {
    const rid = "https://roamresearch.com/#/app/akamatsulab/abc123XYZ";
    expect(nodePathFromRid(rid)).toEqual(roamPath);
    expect(ridFromNodePath({ nodePath: roamPath, isSchema: false })).toBe(rid);
  });

  it("round-trips Obsidian RIDs of nodes and node types", () => {
    const noteRid = "orn:obsidian.note:837541d3a06d1871/f00d-1234";
    const schemaRid = "orn:obsidian.schema:837541d3a06d1871/f00d-1234";
    expect(nodePathFromRid(noteRid)).toEqual(obsidianPath);
    expect(nodePathFromRid(schemaRid)).toEqual(obsidianPath);
    expect(ridFromNodePath({ nodePath: obsidianPath, isSchema: false })).toBe(
      noteRid,
    );
    expect(ridFromNodePath({ nodePath: obsidianPath, isSchema: true })).toBe(
      schemaRid,
    );
  });

  it("rejects a RID on an unknown platform", () => {
    expect(nodePathFromRid("https://example.com/space/node")).toBeUndefined();
    expect(nodePathFromRid("orn:logseq.note:graph/node")).toBeUndefined();
  });
});

describe("addresses", () => {
  it("builds the data, content and node addresses", () => {
    expect(nodeDataUrl({ origin: ORIGIN, nodePath: roamPath })).toBe(
      `${ORIGIN}/api/data/roam/akamatsulab/abc123XYZ`,
    );
    expect(nodeIri({ origin: ORIGIN, nodePath: roamPath })).toBe(
      `${ORIGIN}/api/data/roam/akamatsulab/abc123XYZ#it`,
    );
    expect(nodeContentUrl({ origin: ORIGIN, nodePath: obsidianPath })).toBe(
      `${ORIGIN}/api/content/obsidian/837541d3a06d1871/f00d-1234`,
    );
    expect(spaceDataUrl({ origin: ORIGIN, ...roamPath })).toBe(
      `${ORIGIN}/api/data/roam/akamatsulab`,
    );
  });

  it("percent-encodes segments that are not URL-safe", () => {
    expect(
      nodeDataUrl({
        origin: ORIGIN,
        nodePath: { ...roamPath, spaceKey: "my graph", localId: "a#b" },
      }),
    ).toBe(`${ORIGIN}/api/data/roam/my%20graph/a%23b`);
  });
});
