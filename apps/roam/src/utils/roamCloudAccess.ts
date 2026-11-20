export const ROAM_CLOUD_UNAVAILABLE_MESSAGE =
  "DG cloud features are available only in hosted Roam graphs.";

export const getHostedRoamGraphName = (): string | null => {
  const graph = globalThis.window?.roamAlphaAPI?.graph;
  return graph?.type === "hosted" ? graph.name : null;
};

export const canUseRoamCloud = (): boolean => Boolean(getHostedRoamGraphName());
