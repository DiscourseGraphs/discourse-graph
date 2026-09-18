import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBlockProps: vi.fn(),
  internalError: vi.fn(),
  invalidateDiscourseNodeTypeCaches: vi.fn(),
  setBlockPropsAsync: vi.fn(),
}));

vi.mock("~/utils/getBlockProps", () => ({
  default: mocks.getBlockProps,
}));
vi.mock("~/utils/setBlockProps", () => ({
  setBlockPropsAsync: mocks.setBlockPropsAsync,
}));
vi.mock("~/utils/internalError", () => ({
  default: mocks.internalError,
}));
vi.mock("~/utils/discourseNodeTypeCache", () => ({
  invalidateDiscourseNodeTypeCaches: mocks.invalidateDiscourseNodeTypeCaches,
}));

import {
  migratePropsStoreDefault,
  PROPS_STORE_DEFAULT_MIGRATION_KEY,
} from "~/components/settings/utils/migratePropsStoreDefault";
import { FeatureFlagsSchema } from "~/components/settings/utils/zodSchema";

const BLOCK_UIDS = { "Feature Flags": "feature-flags-uid" };

describe("props settings default migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setBlockPropsAsync.mockResolvedValue({});
  });

  it("keeps legacy as the safe fallback before the rollout completes", () => {
    expect(FeatureFlagsSchema.parse({})["Use new settings store"]).toBe(false);
  });

  it("enables props when an existing graph has no stored flag", async () => {
    mocks.getBlockProps.mockReturnValue({});

    await migratePropsStoreDefault(BLOCK_UIDS);

    expect(mocks.setBlockPropsAsync).toHaveBeenCalledWith(
      "feature-flags-uid",
      {
        [PROPS_STORE_DEFAULT_MIGRATION_KEY]: true,
        "Use new settings store": true,
      },
      false,
    );
  });

  it("enables props once when an existing graph has the previous false default", async () => {
    mocks.getBlockProps.mockReturnValue({ "Use new settings store": false });

    await migratePropsStoreDefault(BLOCK_UIDS);

    expect(mocks.setBlockPropsAsync).toHaveBeenCalledWith(
      "feature-flags-uid",
      {
        [PROPS_STORE_DEFAULT_MIGRATION_KEY]: true,
        "Use new settings store": true,
      },
      false,
    );
    expect(mocks.invalidateDiscourseNodeTypeCaches).toHaveBeenCalledOnce();
  });

  it("keeps an existing true value and records the migration", async () => {
    mocks.getBlockProps.mockReturnValue({ "Use new settings store": true });

    await migratePropsStoreDefault(BLOCK_UIDS);

    expect(mocks.setBlockPropsAsync).toHaveBeenCalledWith(
      "feature-flags-uid",
      { [PROPS_STORE_DEFAULT_MIGRATION_KEY]: true },
      false,
    );
    expect(mocks.invalidateDiscourseNodeTypeCaches).not.toHaveBeenCalled();
  });

  it("preserves an admin false value after the migration marker exists", async () => {
    mocks.getBlockProps.mockReturnValue({
      [PROPS_STORE_DEFAULT_MIGRATION_KEY]: true,
      "Use new settings store": false,
    });

    await migratePropsStoreDefault(BLOCK_UIDS);

    expect(mocks.setBlockPropsAsync).not.toHaveBeenCalled();
    expect(mocks.invalidateDiscourseNodeTypeCaches).not.toHaveBeenCalled();
  });
});
