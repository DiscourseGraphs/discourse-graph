import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import type { Result } from "./types";
import { isCanvasPage } from "./isCanvasPage";

const getAllReferencesOnPage = async (title: string): Promise<Result[]> => {
  title = normalizePageTitle(title);
  let referencedPages: Array<[string, string]> = [];
  if (isCanvasPage({ title })) {
    const oldCanvasContent = window.roamAlphaAPI.data.fast.q(
      `[:find ?uid ?title
      :where
      [?c :node/title "${title}"]
      [?c :block/props ?props]
      [(get ?props :roamjs-query-builder) ?rqb]
      [(get ?rqb :tldraw) [[?k ?v]]]
      [(get ?v :props) ?shape-props]
      [(get ?shape-props :uid) ?uid]
      [?n :block/uid ?uid]
      [?n :node/title ?title]
      ]`,
    ) as Array<[string, string]>;
    const newCanvasContent = window.roamAlphaAPI.data.fast.q(
      `[:find ?uid ?title
      :where
      [?c :node/title "${title}"]
      [?c :block/props ?props]
      [(get ?props :roamjs-query-builder) ?rqb]
      [(get ?rqb :tldraw) ?tldraw]
      [(get ?tldraw :store) [[?k ?v]]]
      [(get ?v :props) ?shape-props]
      [(get ?shape-props :uid) ?uid]
      [?n :block/uid ?uid]
      [?n :node/title ?title]
      ]`,
    ) as Array<[string, string]>;
    referencedPages = [...oldCanvasContent, ...newCanvasContent];
  } else {
    referencedPages = (await window.roamAlphaAPI.data.backend.q(
      `[:find ?uid ?text
      :where
        [?page :node/title "${title}"]
        [?b :block/page ?page]
        [?b :block/refs ?refPage]
        [?refPage :block/uid ?uid]
        [?refPage :node/title ?text]]`,
    )) as Array<[string, string]>;
  }
  return referencedPages.map(([uid, text]) => ({ uid, text }));
};

export default getAllReferencesOnPage;
