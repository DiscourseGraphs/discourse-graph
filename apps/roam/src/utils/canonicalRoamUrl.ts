const ROAM_URL_PREFIX = "https://roamresearch.com/#/app/";
const canonicalRoamUrl = (graphName = window.roamAlphaAPI.graph.name) =>
  ROAM_URL_PREFIX + graphName;
export default canonicalRoamUrl;
