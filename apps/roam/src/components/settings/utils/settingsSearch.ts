import type { SearchableEntry } from "./settingsCatalog";

export const SETTINGS_SEARCH_RESULT_LIMIT = 8;

/** Lower is better, so an exact label is never buried under a description that
 *  happens to mention the same word. */
const MatchTier = {
  exactLabel: 0,
  labelPrefix: 1,
  labelSubstring: 2,
  breadcrumb: 3,
  keyword: 4,
  description: 5,
} as const;

type Tier = (typeof MatchTier)[keyof typeof MatchTier];

const normalize = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

const haystackOf = (entry: SearchableEntry): string =>
  normalize(
    [
      entry.label,
      entry.breadcrumb,
      ...entry.keywords,
      entry.kind === "setting" ? (entry.description ?? "") : "",
    ].join(" "),
  );

const tierFor = (entry: SearchableEntry, query: string): Tier | null => {
  const label = normalize(entry.label);
  if (label === query) return MatchTier.exactLabel;
  if (label.startsWith(query)) return MatchTier.labelPrefix;
  if (label.includes(query)) return MatchTier.labelSubstring;
  if (normalize(entry.breadcrumb).includes(query)) return MatchTier.breadcrumb;
  if (entry.keywords.some((keyword) => normalize(keyword).includes(query)))
    return MatchTier.keyword;
  if (
    entry.kind === "setting" &&
    entry.description &&
    normalize(entry.description).includes(query)
  )
    return MatchTier.description;
  return null;
};

/** Multi-word queries match when every word appears somewhere, but the tier still comes
 *  from the whole query, so single-word precision is not diluted. */
const matches = (
  entry: SearchableEntry,
  query: string,
): { tier: Tier } | null => {
  const whole = tierFor(entry, query);
  if (whole !== null) return { tier: whole };

  const words = query.split(" ").filter(Boolean);
  if (words.length < 2) return null;
  const haystack = haystackOf(entry);
  return words.every((word) => haystack.includes(word))
    ? { tier: MatchTier.description }
    : null;
};

/** Settings before pages at the same tier; then alphabetical, for a stable list. */
const compare = (
  a: { entry: SearchableEntry; tier: Tier },
  b: { entry: SearchableEntry; tier: Tier },
): number => {
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.entry.kind !== b.entry.kind) return a.entry.kind === "setting" ? -1 : 1;
  return a.entry.label.localeCompare(b.entry.label);
};

export const rankSettings = ({
  entries,
  query,
  limit = SETTINGS_SEARCH_RESULT_LIMIT,
}: {
  entries: readonly SearchableEntry[];
  query: string;
  limit?: number;
}): SearchableEntry[] => {
  const normalized = normalize(query);
  if (normalized === "") return [];
  return entries
    .flatMap((entry) => {
      const match = matches(entry, normalized);
      return match ? [{ entry, tier: match.tier }] : [];
    })
    .sort(compare)
    .slice(0, limit)
    .map(({ entry }) => entry);
};
