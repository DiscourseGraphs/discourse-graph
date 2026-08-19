// Navigation + creation for nested sub-page portals. `enterPage` is the one
// navigation gesture — the portal header, breadcrumb segments, and back button
// all funnel through it so they cannot drift apart.
import {
  createShapeId,
  Editor,
  PageRecordType,
  TLPageId,
  TLShape,
  TLShapeId,
} from "tldraw";
import {
  assertCanCreateSubpage,
  getNestedPageMeta,
  LineagePage,
  SUBPAGE_SHAPE_TYPE,
  walkLineage,
} from "~/utils/nestedPages";

export const DEFAULT_PORTAL_ACCENT = "#6d5ae0";
const DEFAULT_PORTAL_WIDTH = 460;
const DEFAULT_PORTAL_HEIGHT = 340;

export const enterPage = (editor: Editor, pageId: string) => {
  if (!pageId || !editor.getPage(pageId as TLPageId)) return;
  editor.setCurrentPage(pageId as TLPageId);
  const bounds = editor.getCurrentPageBounds();
  if (bounds) {
    editor.zoomToBounds(bounds, { inset: 80, animation: { duration: 200 } });
  }
};

export const getLineage = (editor: Editor): LineagePage[] =>
  walkLineage((id) => {
    const page = editor.getPage(id as TLPageId);
    if (!page) return null;
    return {
      id: page.id,
      name: page.name,
      parentPageId: getNestedPageMeta(page.meta)?.parentPageId,
    };
  }, editor.getCurrentPageId());

const getShapeText = (shape: TLShape): string => {
  const props = shape.props as { title?: unknown; text?: unknown };
  if (typeof props.title === "string" && props.title) return props.title;
  if (typeof props.text === "string" && props.text) return props.text;
  return "";
};

/**
 * Create a child page plus a portal into it on the current page, in one batch
 * (SPEC §7 `createSubpage`, eager creation). Throws before touching the store
 * when the page cap is reached — tldraw's `createPage` silently no-ops there,
 * which would strand an orphan portal.
 *
 * If exactly one shape is selected, the portal is titled from its text and
 * placed just below it; otherwise it lands centered in the viewport.
 */
export const createSubpagePortal = ({
  editor,
  title,
  accent = DEFAULT_PORTAL_ACCENT,
}: {
  editor: Editor;
  title?: string;
  accent?: string;
}): { pageId: TLPageId; portalId: TLShapeId } => {
  assertCanCreateSubpage({
    pageCount: editor.getPages().length,
    maxPages: editor.options.maxPages,
  });

  const owner = editor.getOnlySelectedShape();
  const here = editor.getCurrentPageId();
  const name = (title || (owner && getShapeText(owner)) || "Sub-canvas").slice(
    0,
    60,
  );

  // owner.x/y are parent-local — for a card inside a frame they would place the
  // portal near the page origin. Page bounds are what we mean.
  const ownerBounds = owner ? editor.getShapePageBounds(owner.id) : undefined;
  const viewport = editor.getViewportPageBounds();
  const x = ownerBounds
    ? ownerBounds.x
    : viewport.center.x - DEFAULT_PORTAL_WIDTH / 2;
  const y = ownerBounds
    ? ownerBounds.y + ownerBounds.h + 24
    : viewport.center.y - DEFAULT_PORTAL_HEIGHT / 2;

  const pageId = PageRecordType.createId();
  const portalId = createShapeId();
  editor.batch(() => {
    editor.createPage({
      id: pageId,
      name,
      meta: { dgNested: { parentPageId: here, ownerShapeId: portalId } },
    });
    // createPage increments duplicate names ("Study A" → "Study A 1"); keep the
    // portal title in sync with what the page actually got.
    const finalName = editor.getPage(pageId)?.name ?? name;
    editor.createShape({
      id: portalId,
      type: SUBPAGE_SHAPE_TYPE,
      x,
      y,
      // explicit parentId: a portal created over a frame must not be
      // auto-parented into that frame
      parentId: here,
      props: {
        w: DEFAULT_PORTAL_WIDTH,
        h: DEFAULT_PORTAL_HEIGHT,
        title: finalName,
        subtitle: "",
        targetPageId: pageId,
        accent,
      },
    });
    editor.select(portalId);
  });
  return { pageId, portalId };
};

/** Point an existing dg-subpage portal at a page, recording lineage on the
 * target. The recorded parent is the page the portal LIVES ON, not whichever
 * page the session happens to be viewing. */
export const linkSubpagePortal = (
  editor: Editor,
  portalId: TLShapeId,
  targetPageId: TLPageId,
): boolean => {
  const portal = editor.getShape(portalId);
  if (!portal || portal.type !== SUBPAGE_SHAPE_TYPE) return false;
  if (!editor.getPage(targetPageId)) return false;
  const parentPageId =
    editor.getAncestorPageId(portal) ?? editor.getCurrentPageId();
  editor.batch(() => {
    editor.updateShape({
      id: portalId,
      type: SUBPAGE_SHAPE_TYPE,
      props: { targetPageId },
    });
    const page = editor.getPage(targetPageId);
    if (!page) return;
    editor.updatePage({
      id: targetPageId,
      meta: {
        ...page.meta,
        dgNested: { parentPageId, ownerShapeId: portalId },
      },
    });
  });
  return true;
};
