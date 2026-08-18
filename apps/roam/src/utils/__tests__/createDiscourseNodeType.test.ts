import { describe, expect, it, vi } from "vitest";

const { createPageMock } = vi.hoisted(() => ({ createPageMock: vi.fn() }));

vi.mock("roamjs-components/writes", () => ({ createPage: createPageMock }));

import { createDiscourseNodeType } from "~/components/settings/utils/accessors";
import { getDiscourseNodeTypeCacheVersion } from "~/utils/discourseNodeTypeCache";

describe("createDiscourseNodeType", () => {
  // Regression for ENG-2089: getAllDiscourseNodes drops node pages that have no block
  // props, so invalidating the cache before the props write settles let the next reader
  // cache a node list omitting the type just created — invisible until a graph reload.
  it("settles the block props write before invalidating the node type cache", async () => {
    const writtenProps: Record<string, unknown> = {};
    let releaseUpdate: (() => void) | undefined;

    (globalThis as { window?: unknown }).window = {
      roamAlphaAPI: {
        pull: vi.fn(() => ({ ":block/props": writtenProps })),
        util: { generateUID: vi.fn(() => "generated-uid") },
        data: {
          block: {
            update: vi.fn(
              ({ block }: { block: { props: Record<string, unknown> } }) =>
                new Promise<void>((resolve) => {
                  releaseUpdate = () => {
                    Object.assign(writtenProps, block.props);
                    resolve();
                  };
                }),
            ),
          },
        },
      },
    };

    createPageMock.mockResolvedValue("new-page-uid");
    const versionBefore = getDiscourseNodeTypeCacheVersion();

    const pending = createDiscourseNodeType({
      text: "Probe",
      shortcut: "P",
      format: "[[PRO]] - {content}",
    });

    // The write is in flight. Invalidating at this point is the bug.
    await Promise.resolve();
    expect(Object.keys(writtenProps)).toHaveLength(0);
    expect(getDiscourseNodeTypeCacheVersion()).toBe(versionBefore);

    releaseUpdate?.();
    const node = await pending;

    expect(Object.keys(writtenProps).length).toBeGreaterThan(0);
    expect(getDiscourseNodeTypeCacheVersion()).toBe(versionBefore + 1);
    expect(node).toMatchObject({
      type: "new-page-uid",
      text: "Probe",
      shortcut: "P",
      format: "[[PRO]] - {content}",
      backedBy: "user",
    });
  });

  it("creates the node page under the discourse node prefix", async () => {
    (globalThis as { window?: unknown }).window = {
      roamAlphaAPI: {
        pull: vi.fn(() => ({ ":block/props": {} })),
        util: { generateUID: vi.fn(() => "generated-uid") },
        data: { block: { update: vi.fn(() => Promise.resolve()) } },
      },
    };
    createPageMock.mockResolvedValue("another-uid");
    await createDiscourseNodeType({
      text: "Claim",
      shortcut: "C",
      format: "[[CLM]] - {content}",
    });

    expect(createPageMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "discourse-graph/nodes/Claim" }),
    );
  });
});
