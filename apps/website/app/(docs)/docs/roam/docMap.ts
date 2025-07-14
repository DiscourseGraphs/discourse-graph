import { sharedDocMap } from "~/(docs)/docs/shared/docMap";

const ROAM_DOCS = "app/(docs)/docs/roam/pages";
type DocMapType = {
  default: string;
  [key: string]: string;
};

export const docMap: DocMapType = {
  default: ROAM_DOCS,
  ...sharedDocMap,
};
