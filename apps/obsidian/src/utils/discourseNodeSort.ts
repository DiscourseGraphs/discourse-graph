import { TFile } from "obsidian";
import { isUnattributedAuthorName } from "~/utils/discourseNodeAuthor";

/**
 * Client-side ordering for discourse node search results. Sorting runs over the
 * full ranked list before it is truncated for display — sorting a
 * relevance-truncated window would show the alphabetically-first 50 of the
 * best-matching 50, which is not what any of these options mean.
 * Ported from Roam's advanced search so both apps offer the same dimensions.
 */

export type SortKey =
  | "relevance"
  | "title"
  | "dateCreated"
  | "dateModified"
  | "author";

export type SortDirection = "asc" | "desc";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "title", label: "Alphabetical" },
  { key: "dateCreated", label: "Date created" },
  { key: "dateModified", label: "Date modified" },
  { key: "author", label: "Author" },
];

export const DEFAULT_SORT_KEY: SortKey = "relevance";
/** Descending reads as "best first" for scores and "newest first" for dates. */
export const DEFAULT_SORT_DIRECTION: SortDirection = "desc";

/**
 * Structural rather than tied to `RankedDiscourseNode`, so the sort can run on
 * the ranked list or on rows that have already been decorated for display.
 */
export type SortableSearchResult = {
  file: TFile;
  title: string;
  match: { score: number };
};

const DIRECTION_LABELS: Record<SortKey, Record<SortDirection, string>> = {
  relevance: { desc: "Best match first", asc: "Worst match first" },
  title: { asc: "A to Z", desc: "Z to A" },
  dateCreated: { desc: "Newest first", asc: "Oldest first" },
  dateModified: { desc: "Newest first", asc: "Oldest first" },
  author: { asc: "A to Z", desc: "Z to A" },
};

export const getSortDirectionLabel = ({
  sortKey,
  direction,
}: {
  sortKey: SortKey;
  direction: SortDirection;
}): string => DIRECTION_LABELS[sortKey][direction];

/**
 * Switching dimension resets the direction, because "descending" means
 * something different per dimension: keeping it would turn a switch to
 * alphabetical into an unasked-for Z-to-A.
 */
export const getDefaultDirectionForKey = (sortKey: SortKey): SortDirection =>
  sortKey === "title" || sortKey === "author" ? "asc" : "desc";

export const isDefaultSort = ({
  sortKey,
  direction,
}: {
  sortKey: SortKey;
  direction: SortDirection;
}): boolean =>
  sortKey === DEFAULT_SORT_KEY && direction === DEFAULT_SORT_DIRECTION;

export const getSortOptionLabel = (sortKey: SortKey): string =>
  SORT_OPTIONS.find((option) => option.key === sortKey)?.label ?? "";

const getAuthorName = ({
  result,
  authorNameByPath,
}: {
  result: SortableSearchResult;
  authorNameByPath: Map<string, string> | undefined;
}): string => authorNameByPath?.get(result.file.path) ?? "";

/**
 * Unattributed notes sit after every named author in both directions, so
 * reversing the sort never buries the readable names under a block of
 * "Unknown". Returns 0 when the two sides agree, leaving the ordering to the
 * name comparison.
 */
const compareUnattributedLast = ({
  a,
  b,
  authorNameByPath,
}: {
  a: SortableSearchResult;
  b: SortableSearchResult;
  authorNameByPath: Map<string, string> | undefined;
}): number => {
  const isAUnattributed = isUnattributedAuthorName(
    getAuthorName({ result: a, authorNameByPath }),
  );
  const isBUnattributed = isUnattributedAuthorName(
    getAuthorName({ result: b, authorNameByPath }),
  );
  if (isAUnattributed === isBUnattributed) return 0;
  return isAUnattributed ? 1 : -1;
};

const compareAscending = ({
  a,
  b,
  sortKey,
  authorNameByPath,
}: {
  a: SortableSearchResult;
  b: SortableSearchResult;
  sortKey: SortKey;
  authorNameByPath: Map<string, string> | undefined;
}): number => {
  if (sortKey === "relevance") return a.match.score - b.match.score;
  if (sortKey === "title") return a.title.localeCompare(b.title);
  if (sortKey === "dateCreated") return a.file.stat.ctime - b.file.stat.ctime;
  if (sortKey === "dateModified") return a.file.stat.mtime - b.file.stat.mtime;

  // Same-author notes end up adjacent, and the title breaks the tie inside each
  // group so the order is stable rather than left to vault iteration.
  const authorDelta = getAuthorName({
    result: a,
    authorNameByPath,
  }).localeCompare(getAuthorName({ result: b, authorNameByPath }));
  return authorDelta !== 0 ? authorDelta : a.title.localeCompare(b.title);
};

/**
 * `authorNameByPath` is only needed for the author sort; the other keys ignore
 * it so callers can skip resolving names for the whole list.
 */
export const sortSearchResults = <T extends SortableSearchResult>({
  results,
  sortKey,
  direction,
  authorNameByPath,
}: {
  results: T[];
  sortKey: SortKey;
  direction: SortDirection;
  authorNameByPath?: Map<string, string>;
}): T[] =>
  [...results].sort((a, b) => {
    if (sortKey === "author") {
      // Outside the direction flip on purpose: this partition is not reversible.
      const unattributedDelta = compareUnattributedLast({
        a,
        b,
        authorNameByPath,
      });
      if (unattributedDelta !== 0) return unattributedDelta;
    }
    const delta = compareAscending({ a, b, sortKey, authorNameByPath });
    return direction === "asc" ? delta : -delta;
  });
