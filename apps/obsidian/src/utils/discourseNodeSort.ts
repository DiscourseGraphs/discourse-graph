import { TFile } from "obsidian";
import { isUnattributedAuthorName } from "~/utils/discourseNodeAuthor";

/** Client-side result ordering, over the full ranked list before display truncation. Mirrors Roam's advanced search. */

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
export const DEFAULT_SORT_DIRECTION: SortDirection = "desc";

/** Structural, so the sort runs on ranked results or decorated rows alike. */
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

/** "Descending" means something different per dimension, so switching resets it. */
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

/** Unattributed notes sit after every named author, in both directions. */
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

  const authorDelta = getAuthorName({
    result: a,
    authorNameByPath,
  }).localeCompare(getAuthorName({ result: b, authorNameByPath }));
  return authorDelta !== 0 ? authorDelta : a.title.localeCompare(b.title);
};

/** `authorNameByPath` is only needed for the author sort. */
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
