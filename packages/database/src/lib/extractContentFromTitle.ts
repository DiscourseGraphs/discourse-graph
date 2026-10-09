import { CONTENT_PLACEHOLDER, FORMAT_PLACEHOLDER } from "./decorateTitle";
import { getDiscourseNodeFormatExpression } from "./getDiscourseNodeFormatExpression";

// A matched-but-empty {content} capture yields "" instead of falling back to
// the decorated title, so the decorate/undecorate round trip holds for empty
// content.
export const extractContentFromTitle = (
  format: string,
  title: string,
): string => {
  const contentIndex = (format.match(FORMAT_PLACEHOLDER) ?? []).findIndex(
    (placeholder) => placeholder.toLowerCase() === CONTENT_PLACEHOLDER,
  );
  if (contentIndex < 0) return title;
  const content =
    getDiscourseNodeFormatExpression(format).exec(title)?.[contentIndex + 1];
  return content === undefined ? title : content.trim();
};
