import { beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateDiscourseNodeTypeCaches } from "~/utils/discourseNodeTypeCache";
import { setBlockPropsAsync } from "~/utils/setBlockProps";
import { getAllDiscourseNodes } from "~/components/settings/utils/accessors";

type NodePage = {
  uid: string;
  title: string;
  props: Record<string, unknown> | null;
};

const nodeProps = (text: string) => ({
  ":text": text,
  ":type": "unused-overwritten-by-pageUid",
  ":format": `[[${text.slice(0, 3).toUpperCase()}]] - {content}`,
  ":shortcut": text.slice(0, 1).toUpperCase(),
});

const setRoamAlphaAPI = (pages: NodePage[]) => {
  const roamAlphaAPI = {
    data: {
      fast: {
        q: vi.fn(() =>
          pages.map((p) => [
            p.uid,
            p.title,
            p.props ? { ":block/props": p.props } : null,
          ]),
        ),
      },
      block: { update: vi.fn(() => Promise.resolve()) },
    },
    util: { generateUID: vi.fn(() => "generated-uid") },
    pull: vi.fn(() => null),
  };
  (globalThis as { window?: unknown }).window = { roamAlphaAPI };
  return roamAlphaAPI;
};

describe("getAllDiscourseNodes caching", () => {
  beforeEach(() => {
    invalidateDiscourseNodeTypeCaches();
  });

  it("excludes node pages that have no block props", () => {
    setRoamAlphaAPI([
      {
        uid: "has-props",
        title: "discourse-graph/nodes/Claim",
        props: nodeProps("Claim"),
      },
      {
        uid: "no-props",
        title: "discourse-graph/nodes/JustCreated",
        props: null,
      },
    ]);

    expect(getAllDiscourseNodes().map((n) => n.text)).toEqual(["Claim"]);
  });

  it("uses the page uid as the node type rather than the stored type prop", () => {
    setRoamAlphaAPI([
      {
        uid: "page-uid-1",
        title: "discourse-graph/nodes/Claim",
        props: nodeProps("Claim"),
      },
    ]);

    expect(getAllDiscourseNodes()[0].type).toBe("page-uid-1");
  });

  // Regression for ENG-2089: the cache is keyed on a version counter, so a node type
  // whose props land after the counter was bumped stays invisible until the next bump.
  // This is why the create flow must write props BEFORE invalidating.
  it("keeps serving a stale list until the cache is invalidated", () => {
    const pages: NodePage[] = [
      {
        uid: "claim",
        title: "discourse-graph/nodes/Claim",
        props: nodeProps("Claim"),
      },
    ];
    setRoamAlphaAPI(pages);

    expect(getAllDiscourseNodes().map((n) => n.text)).toEqual(["Claim"]);

    // Props land after the version was already consumed — as happens when a fire-and-forget
    // write resolves after invalidate + refreshConfigTree have rebuilt the cache.
    pages.push({
      uid: "probe",
      title: "discourse-graph/nodes/Probe",
      props: nodeProps("Probe"),
    });

    expect(getAllDiscourseNodes().map((n) => n.text)).toEqual(["Claim"]);

    invalidateDiscourseNodeTypeCaches();

    expect(getAllDiscourseNodes().map((n) => n.text)).toEqual([
      "Claim",
      "Probe",
    ]);
  });
});

describe("setBlockPropsAsync write ordering", () => {
  it("resolves only after the underlying block update resolves", async () => {
    let releaseUpdate: (() => void) | undefined;
    const updateSettled = vi.fn();
    const roamAlphaAPI = {
      pull: vi.fn(() => ({})),
      data: {
        block: {
          update: vi.fn(
            () =>
              new Promise<void>((resolve) => {
                releaseUpdate = () => {
                  updateSettled();
                  resolve();
                };
              }),
          ),
        },
      },
    };
    (globalThis as { window?: unknown }).window = { roamAlphaAPI };

    const invalidateSpy = vi.fn();
    const write = setBlockPropsAsync("page-uid", { text: "Probe" }).then(() => {
      invalidateSpy();
    });

    // The bug: invalidating here runs before the write has settled.
    await Promise.resolve();
    expect(updateSettled).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();

    releaseUpdate?.();
    await write;

    expect(updateSettled).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();
    expect(roamAlphaAPI.data.block.update).toHaveBeenCalledWith({
      block: { uid: "page-uid", props: { text: "Probe" } },
    });
  });
});
