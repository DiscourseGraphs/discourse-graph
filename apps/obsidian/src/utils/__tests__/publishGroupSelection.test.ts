import { describe, it, expect } from "vitest";
import { EVERYONE_UID } from "@repo/database/lib/groups";
import {
  buildPublishGroupPickerItems,
  isPublishedToWeb,
  isPublishToAllItem,
  isPublishToWebItem,
  PUBLISH_TO_WEB_LABEL,
} from "~/utils/publishGroupSelection";

describe("isPublishedToWeb", () => {
  it("is true once the everyone pseudo-user is among the published groups", () => {
    expect(isPublishedToWeb({ publishedToGroups: ["g1", EVERYONE_UID] })).toBe(
      true,
    );
  });

  it("is false for group-only or unpublished nodes", () => {
    expect(isPublishedToWeb({ publishedToGroups: ["g1"] })).toBe(false);
    expect(isPublishedToWeb({})).toBe(false);
  });
});

describe("buildPublishGroupPickerItems", () => {
  const groups = [
    { id: "g1", name: "Lab", isPublished: true },
    { id: "g2", name: "Reading club", isPublished: false },
  ];

  it("offers the web first, then all groups, then each group", () => {
    const items = buildPublishGroupPickerItems({
      groups,
      publishedToWeb: false,
    });
    expect(items.map((item) => item.name)).toEqual([
      PUBLISH_TO_WEB_LABEL,
      "Publish to all groups",
      "Lab",
      "Reading club",
    ]);
    expect(isPublishToWebItem(items[0]!)).toBe(true);
    expect(items[0]!.id).toBe(EVERYONE_UID);
    expect(isPublishToAllItem(items[1]!)).toBe(true);
  });

  it("marks the web entry published when the node is public", () => {
    const [webItem] = buildPublishGroupPickerItems({
      groups,
      publishedToWeb: true,
    });
    expect(webItem!.isPublished).toBe(true);
  });

  it("offers the web even to someone in no group", () => {
    const items = buildPublishGroupPickerItems({
      groups: [],
      publishedToWeb: false,
    });
    expect(items.filter(isPublishToWebItem)).toHaveLength(1);
  });
});
