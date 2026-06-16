import type { DiscourseRelation } from "./getDiscourseRelations";

const PLACEHOLDER_VALUES = new Set(["?"]);

const isNonEmptyNonPlaceholder = (
  value: string | null | undefined,
): boolean => {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && !PLACEHOLDER_VALUES.has(trimmed);
};

export const isRelationComplete = (
  relation: Partial<DiscourseRelation>,
): boolean =>
  isNonEmptyNonPlaceholder(relation.label) &&
  isNonEmptyNonPlaceholder(relation.complement) &&
  isNonEmptyNonPlaceholder(relation.source) &&
  isNonEmptyNonPlaceholder(relation.destination);
