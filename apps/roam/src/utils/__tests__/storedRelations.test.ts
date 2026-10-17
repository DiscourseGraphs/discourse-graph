import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSetting, setSetting } from "~/utils/extensionSettings";
import { getStoredRelationsEnabled } from "~/utils/storedRelations";

vi.mock("~/utils/extensionSettings", () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(() => Promise.resolve()),
}));

const BEFORE_CUTOFF = Date.parse("2025-07-16T00:00:00.000Z");
const AFTER_CUTOFF = Date.parse("2026-04-01T00:00:00.000Z");

const stubGraph = ({
  personalProps,
  createdAt,
}: {
  personalProps?: Record<string, unknown>;
  createdAt: number;
}): void => {
  vi.stubGlobal("window", {
    roamAlphaAPI: {
      user: { uid: () => "user-uid" },
      pull: (pattern: string) =>
        pattern.includes(":create/time")
          ? { ":create/time": createdAt }
          : {
              ":block/children": [
                { ":block/string": "Global", ":block/props": {} },
                ...(personalProps
                  ? [
                      {
                        ":block/string": "user-uid",
                        ":block/props": personalProps,
                      },
                    ]
                  : []),
              ],
            },
    },
  });
};

beforeEach(() => {
  vi.mocked(getSetting).mockReturnValue(undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("getStoredRelationsEnabled", () => {
  it("uses the extension setting when present", () => {
    vi.mocked(getSetting).mockReturnValue(false);
    stubGraph({
      personalProps: { ":Reified relation triples": true },
      createdAt: AFTER_CUTOFF,
    });
    expect(getStoredRelationsEnabled()).toBe(false);
    expect(setSetting).not.toHaveBeenCalled();
  });

  it("restores an enabled choice from the graph after the extension settings reset", () => {
    stubGraph({
      personalProps: { ":Reified relation triples": true },
      createdAt: BEFORE_CUTOFF,
    });
    expect(getStoredRelationsEnabled()).toBe(true);
    expect(setSetting).toHaveBeenCalledWith("use-reified-relations", true);
  });

  it("keeps a disabled choice from the graph on a new graph", () => {
    stubGraph({
      personalProps: { ":Reified relation triples": false },
      createdAt: AFTER_CUTOFF,
    });
    expect(getStoredRelationsEnabled()).toBe(false);
    expect(setSetting).toHaveBeenCalledWith("use-reified-relations", false);
  });

  it.each([
    [BEFORE_CUTOFF, false],
    [AFTER_CUTOFF, true],
  ])(
    "falls back to the install default when the graph has no choice (created %d)",
    (createdAt, expected) => {
      stubGraph({ createdAt });
      expect(getStoredRelationsEnabled()).toBe(expected);
      expect(setSetting).toHaveBeenCalledWith(
        "use-reified-relations",
        expected,
      );
    },
  );
});
