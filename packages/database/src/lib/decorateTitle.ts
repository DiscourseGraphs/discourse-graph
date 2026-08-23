// Inverse of the apps' extractContentFromTitle: rebuild a local title from a
// node type format and the core_title stored in Concept.literal_content.
// "{content}" takes the core title; every other placeholder (e.g. "{Source}")
// becomes the empty string, so "[[EVD]] - {content} - {Source}" yields
// "[[EVD]] - <core title> - ". Callers decide the fallback when the format is
// empty or the core title is missing.
const FORMAT_PLACEHOLDER = /{[a-zA-Z]+}/g;

export const decorateTitle = (format: string, coreTitle: string): string =>
  format.replace(FORMAT_PLACEHOLDER, (placeholder) =>
    placeholder.toLowerCase() === "{content}" ? coreTitle : "",
  );
