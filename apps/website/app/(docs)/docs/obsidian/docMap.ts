import { DocMapType, sharedDocMap } from "~/(docs)/docs/shared/docMap";

const OBSIDIAN_DOCS = "app/(docs)/docs/obsidian/pages";

export const docMap: DocMapType = {
  default: OBSIDIAN_DOCS,
  ...sharedDocMap,
};
