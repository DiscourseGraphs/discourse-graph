// Inverse of the apps' extractContentFromTitle: rebuild a local title from a
// node type format and the core_title stored in Concept.literal_content.
// Returns null when the format cannot be rebuilt from the core title alone:
// it is empty, has no {content} placeholder, or carries other placeholders
// such as {Source} whose values the database does not hold yet. Callers fall
// back to the incoming title in that case.
export const FORMAT_PLACEHOLDER = /{[a-zA-Z]+}/g;

export const decorateTitle = (
  format: string,
  coreTitle: string,
): string | null => {
  const placeholders = format.match(FORMAT_PLACEHOLDER) ?? [];
  if (
    placeholders.length === 0 ||
    placeholders.some(
      (placeholder) => placeholder.toLowerCase() !== "{content}",
    )
  )
    return null;
  return format.replace(FORMAT_PLACEHOLDER, () => coreTitle);
};
