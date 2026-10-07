// Matches a relation's ends against its relation type's triples. The Roam and Obsidian
// importers share it so both pick the same source triple.

// A triple end whose schema is hidden has only the name parsed from the triple's name.
export type NodeTypeIdentity = {
  rid?: string;
  localId?: string;
  importedFromRid?: string;
  name?: string;
};

const normalizeName = (name: string): string => name.trim().toLowerCase();

// The same in every Roam graph; keep in sync with `type` in Roam's `defaultDiscourseNodes`.
// Check the exact list: a user-created type's id may also start with `_`.
export const ROAM_DEFAULT_NODE_TYPE_IDS: ReadonlySet<string> = new Set([
  "_CLM-node",
  "_QUE-node",
  "_EVD-node",
  "_SRC-node",
]);

// Id or import origin outranks name, as in Obsidian's node type import (id, then name,
// else a copy keeping the source's id). A bare id match across spaces covers import
// chains whose middle space is hidden; default ids don't count, as unrelated graphs share them.
export const matchNodeTypes = (
  a: NodeTypeIdentity,
  b: NodeTypeIdentity,
): "strong" | "name" | undefined => {
  const sameValue = (x?: string, y?: string) => x !== undefined && x === y;
  if (
    sameValue(a.rid, b.rid) ||
    (sameValue(a.localId, b.localId) &&
      !ROAM_DEFAULT_NODE_TYPE_IDS.has(a.localId!)) ||
    sameValue(a.importedFromRid, b.rid) ||
    sameValue(a.rid, b.importedFromRid) ||
    sameValue(a.importedFromRid, b.importedFromRid)
  )
    return "strong";
  if (
    a.name !== undefined &&
    b.name !== undefined &&
    normalizeName(a.name) === normalizeName(b.name)
  )
    return "name";
  return undefined;
};

// Candidates matching more ends strongly decide first. A tie at the best rank means
// duplicate node types in the source space, so nothing is picked.
export const pickTripleCandidate = <T>(
  candidates: {
    candidate: T;
    source: NodeTypeIdentity;
    destination: NodeTypeIdentity;
  }[],
  ends: { source: NodeTypeIdentity; destination: NodeTypeIdentity },
): T | undefined => {
  const scored = candidates
    .map(({ candidate, source, destination }) => ({
      candidate,
      matches: [
        matchNodeTypes(ends.source, source),
        matchNodeTypes(ends.destination, destination),
      ],
    }))
    .filter(({ matches }) => matches.every((m) => m !== undefined));
  const strongCount = (matches: (string | undefined)[]) =>
    matches.filter((m) => m === "strong").length;
  const best = Math.max(...scored.map(({ matches }) => strongCount(matches)));
  const deciding = scored.filter(
    ({ matches }) => strongCount(matches) === best,
  );
  return deciding.length === 1 ? deciding[0]!.candidate : undefined;
};

// Obsidian names a triple `Source -label-> Destination`.
export const parseTripleEndNames = (
  tripleName: string,
  label: string,
): { source: string; destination: string } | undefined => {
  const parts = tripleName.split(` -${label}-> `);
  if (parts.length !== 2) return undefined;
  return { source: parts[0]!, destination: parts[1]! };
};
