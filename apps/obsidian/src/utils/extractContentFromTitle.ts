import { getDiscourseNodeFormatExpression } from "./getDiscourseNodeFormatExpression";

export const extractContentFromTitle = (
  format: string,
  title: string,
): string => {
  if (!format) return title;

  const placeholderRegex = /{([a-zA-Z]+)}/g;
  const placeholders: string[] = [];
  let placeholderMatch: RegExpExecArray | null;
  while ((placeholderMatch = placeholderRegex.exec(format))) {
    placeholders.push(placeholderMatch[1] ?? "");
  }
  const regex = getDiscourseNodeFormatExpression(format);
  const match = regex.exec(title);
  if (!match) return title;

  const contentIndex = placeholders.findIndex(
    (name) => name.toLowerCase() === "content",
  );
  const capture = contentIndex >= 0 ? match[contentIndex + 1] : match[1];
  return capture === undefined ? title : capture.trim();
};
