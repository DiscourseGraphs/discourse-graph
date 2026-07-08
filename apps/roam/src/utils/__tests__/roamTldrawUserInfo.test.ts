import { describe, expect, it, vi } from "vitest";
import { getCurrentRoamTldrawUserInfo } from "~/utils/roamTldrawUserInfo";

const createRoamAlphaAPI = ({
  userUid = "user-1",
  displayName = "Michael Gartner",
}: {
  userUid?: string | null;
  displayName?: string | null;
} = {}) => {
  return {
    pull: vi.fn(() =>
      displayName === null ? {} : { ":user/display-name": displayName },
    ),
    user: {
      uid: vi.fn(() => userUid),
    },
  };
};

const setRoamAlphaAPI = (roamAlphaAPI: unknown): void => {
  (globalThis as { window: unknown }).window = { roamAlphaAPI };
};

describe("getCurrentRoamTldrawUserInfo", () => {
  it("returns the Roam user uid and display name for tldraw presence", () => {
    const roamAlphaAPI = createRoamAlphaAPI({
      userUid: "84ojr3XNc8cu6TiO7nXnfH3zR1D2",
      displayName: "Michael Gartner",
    });
    setRoamAlphaAPI(roamAlphaAPI);

    expect(getCurrentRoamTldrawUserInfo()).toEqual({
      id: "84ojr3XNc8cu6TiO7nXnfH3zR1D2",
      name: "Michael Gartner",
    });
    expect(roamAlphaAPI.pull).toHaveBeenCalledWith("[*]", [
      ":user/uid",
      "84ojr3XNc8cu6TiO7nXnfH3zR1D2",
    ]);
  });

  it("omits the presence name when Roam has no display name", () => {
    const roamAlphaAPI = createRoamAlphaAPI({ displayName: null });
    setRoamAlphaAPI(roamAlphaAPI);

    expect(getCurrentRoamTldrawUserInfo()).toEqual({
      id: "user-1",
    });
  });

  it("keeps presence usable when the Roam user pull fails", () => {
    const roamAlphaAPI = createRoamAlphaAPI();
    roamAlphaAPI.pull.mockImplementation(() => {
      throw new Error("Roam pull failed");
    });
    setRoamAlphaAPI(roamAlphaAPI);

    expect(getCurrentRoamTldrawUserInfo()).toEqual({
      id: "user-1",
    });
  });

  it("returns undefined when the Roam user uid is unavailable", () => {
    const roamAlphaAPI = createRoamAlphaAPI({ userUid: null });
    setRoamAlphaAPI(roamAlphaAPI);

    expect(getCurrentRoamTldrawUserInfo()).toBeUndefined();
    expect(roamAlphaAPI.pull).not.toHaveBeenCalled();
  });
});
