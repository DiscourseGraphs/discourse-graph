// Functions to express a pair of spaceUri, sourceLocalId as a single string, and back.
// We're following https://github.com/BlockScience/rid-lib:
// Either a Web URL, with the last segment as the sourceLocalId;
// OR the format `orn:<platform>.<subtype>:<source identifier>/<sourceLocalId>`
// With the assumption that the sourceUri has the form <platform>:<source identifier>
// The subtype may be omitted.

export const spaceUriAndLocalIdToRid = (
  spaceUri: string,
  localId: string,
  subtype?: string,
): string => {
  if (spaceUri.startsWith("http")) return `${spaceUri}/${localId}`;
  const parts = spaceUri.split(":");
  if (parts.length === 2)
    return subtype
      ? `orn:${parts[0]}.${subtype}:${parts[1]}/${localId}`
      : `orn:${parts[0]}:${parts[1]}/${localId}`;
  throw new Error("Unrecognized spaceUri");
};

export const ridToSpaceUriAndLocalId = (
  rid: string,
): { spaceUri: string; sourceLocalId: string } => {
  const m = rid.match(/^orn:(\w+)\.(\w+):(.*)\/([^/]+)$/);
  if (m) {
    return { spaceUri: `${m[1]}:${m[3]}`, sourceLocalId: m[4]! };
  }
  const m2 = rid.match(/^orn:(\w+):(.*)\/([^/]+)$/);
  if (m2) {
    return { spaceUri: `${m2[1]}:${m2[2]}`, sourceLocalId: m2[3]! };
  }
  const parts = rid.split("/");
  const sourceLocalId = parts.pop()!;
  return { spaceUri: parts.join("/"), sourceLocalId };
};
