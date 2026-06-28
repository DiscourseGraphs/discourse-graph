let suppressionDepth = 0;

type CanvasRecordSource = "remote" | "user";

export const areAutoCanvasRelationsSuppressed = (): boolean =>
  suppressionDepth > 0;

export const shouldCreateAutoCanvasRelations = ({
  source,
}: {
  source: CanvasRecordSource;
}): boolean => source === "user" && !areAutoCanvasRelationsSuppressed();

export const withAutoCanvasRelationsSuppressed = <T>(callback: () => T): T => {
  suppressionDepth += 1;
  try {
    return callback();
  } finally {
    suppressionDepth -= 1;
  }
};
