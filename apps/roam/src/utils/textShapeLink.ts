type UnknownRecord = {
  typeName?: unknown;
  type?: unknown;
  props?: Record<string, unknown>;
};

export const isTextShapeRecord = (record: unknown): boolean => {
  if (typeof record !== "object" || record === null) return false;
  const { typeName, type, props } = record as UnknownRecord;
  return (
    typeName === "shape" &&
    type === "text" &&
    typeof props === "object" &&
    props !== null
  );
};

// tldraw gates its Edit link action on `'url' in shape.props`, so a text shape
// missing the key is silently ineligible rather than failing loudly.
export const hasLinkUrlProp = (record: unknown): boolean => {
  if (typeof record !== "object" || record === null) return false;
  const { props } = record as UnknownRecord;
  return typeof props === "object" && props !== null && "url" in props;
};

// Never overwrite an existing url: an earlier migration shipped an
// unconditional assignment and had to be corrected (PR #916).
export const backfillTextShapeUrl = (record: unknown): void => {
  if (!isTextShapeRecord(record)) return;
  const { props } = record as Required<UnknownRecord>;
  if (props.url === undefined) props.url = "";
};
