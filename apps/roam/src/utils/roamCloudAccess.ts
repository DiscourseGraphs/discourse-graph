export const ROAM_CLOUD_UNAVAILABLE_MESSAGE =
  "DG cloud features are available only in hosted Roam graphs.";

export const canUseRoamCloud = (): boolean =>
  globalThis.window?.roamAlphaAPI?.graph?.type !== "offline";
