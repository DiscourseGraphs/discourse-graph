type Point = { x: number; y: number };

export type TinyHandStroke = {
  end: Point;
  path: string;
};

export const startTinyHandStroke = (point: Point): TinyHandStroke => ({
  end: point,
  path: "",
});

export const extendTinyHandStroke = (
  stroke: TinyHandStroke,
  point: Point,
  zoom: number,
): TinyHandStroke => {
  const distance =
    Math.hypot(point.x - stroke.end.x, point.y - stroke.end.y) * zoom;
  if (distance < (stroke.path ? 1 : 4)) return stroke;

  const path = stroke.path || `M ${stroke.end.x} ${stroke.end.y}`;
  return { ...stroke, end: point, path: `${path} L ${point.x} ${point.y}` };
};
