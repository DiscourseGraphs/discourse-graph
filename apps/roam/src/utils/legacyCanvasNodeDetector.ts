export const ROAM_UID_PATTERN = /^[A-Za-z0-9_-]{9}$/;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isLegacyCanvasNodeCandidate = (record: unknown): boolean => {
  if (!isRecord(record) || record.typeName !== "shape") return false;
  if (typeof record.type !== "string" || !ROAM_UID_PATTERN.test(record.type)) {
    return false;
  }
  if (!isRecord(record.props) || typeof record.props.uid !== "string") {
    return false;
  }
  return ROAM_UID_PATTERN.test(record.props.uid);
};

export const isLegacyCanvasNodeRecord = (record: unknown): boolean => {
  if (!isLegacyCanvasNodeCandidate(record) || !isRecord(record)) return false;
  if (!isRecord(record.props)) return false;
  const { h, w } = record.props;
  return (
    typeof w === "number" &&
    Number.isFinite(w) &&
    w > 0 &&
    typeof h === "number" &&
    Number.isFinite(h) &&
    h > 0
  );
};

export const getLegacyCanvasNodeRecords = (
  records: Iterable<unknown>,
): UnknownRecord[] =>
  Array.from(records).filter((record): record is UnknownRecord =>
    isLegacyCanvasNodeRecord(record),
  );
