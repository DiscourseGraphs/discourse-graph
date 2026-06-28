let suppressionDepth = 0;

export const areAutoCanvasRelationsSuppressed = (): boolean =>
  suppressionDepth > 0;

export const withAutoCanvasRelationsSuppressed = <T>(callback: () => T): T => {
  suppressionDepth += 1;
  try {
    return callback();
  } finally {
    suppressionDepth -= 1;
  }
};
