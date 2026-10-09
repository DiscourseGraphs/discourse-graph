import type { Editor } from "tldraw";
import DiscourseGraphPlugin from "~/index";
import {
  parseObsidianOpenUrl,
  resolveObsidianUrlToFile,
} from "~/components/canvas/utils/externalContentHandlers";
import {
  openFileInNewLeaf,
  openFileInNewTab,
  openFileInSidebar,
} from "~/components/canvas/utils/openFileUtils";
import { showToast } from "~/components/canvas/utils/toastUtils";
import { isObsidianUrl } from "~/components/canvas/utils/textShapeLink";

type NavigateLinkDetail = {
  url: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
};

// Patched tldraw dispatches this from every HyperlinkButton, so one listener
// covers text-shape links and geo/note/image links alike.
export const NAVIGATE_LINK_EVENT = "tldraw.navigate-link";

export const registerLinkNavigation = (
  editor: Editor,
  plugin: DiscourseGraphPlugin,
): (() => void) => {
  const container = editor.getContainer();

  const onNavigate = (event: Event) => {
    const { url, metaKey, ctrlKey, altKey } = (
      event as CustomEvent<NavigateLinkDetail>
    ).detail;
    if (!isObsidianUrl(url)) return;
    // Cancelling tells tldraw to preventDefault, so the URI never reaches the
    // OS handler and we keep the cross-vault check below.
    event.preventDefault();

    // The validator parses with `new URL`, so geo links may be stored as
    // `Obsidian://…` or with leading spaces; the parser expects the normal form.
    const parsed = parseObsidianOpenUrl(new URL(url).toString());
    const file = parsed ? resolveObsidianUrlToFile(plugin, parsed) : null;
    if (!file) {
      showToast({
        severity: "warning",
        title: "Cannot open link",
        description: "The linked file is not in this vault",
      });
      return;
    }

    // Mirrors the discourse-node gestures in TldrawViewComponent.
    const open = altKey
      ? openFileInNewLeaf
      : metaKey || ctrlKey
        ? openFileInNewTab
        : openFileInSidebar;
    void open(plugin.app, file);
    editor.selectNone();
  };

  container.addEventListener(NAVIGATE_LINK_EVENT, onNavigate);
  return () => container.removeEventListener(NAVIGATE_LINK_EVENT, onNavigate);
};
