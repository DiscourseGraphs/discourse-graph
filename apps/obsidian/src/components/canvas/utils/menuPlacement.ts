type Point = { x: number; y: number };
type Size = { width: number; height: number };

const clampAxis = ({
  centre,
  before,
  after,
  length,
  margin,
}: {
  centre: number;
  before: number;
  after: number;
  length: number;
  margin: number;
}): number => {
  const min = margin + before;
  const max = length - margin - after;
  // Too big to fit: keep the start edge visible, where the header and + are.
  if (max < min) return min;
  return Math.min(Math.max(centre, min), max);
};

/** Centre of a centred menu, moved just enough to keep it and a right-side flyout inside the viewport. */
export const clampMenuCentre = ({
  anchor,
  menu,
  flyoutWidth,
  viewport,
  margin,
}: {
  anchor: Point;
  menu: Size;
  flyoutWidth: number;
  viewport: Size;
  margin: number;
}): Point => ({
  x: clampAxis({
    centre: anchor.x,
    before: menu.width / 2,
    after: menu.width / 2 + flyoutWidth,
    length: viewport.width,
    margin,
  }),
  y: clampAxis({
    centre: anchor.y,
    before: menu.height / 2,
    after: menu.height / 2,
    length: viewport.height,
    margin,
  }),
});
