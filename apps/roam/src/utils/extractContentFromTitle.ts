import getDiscourseNodeFormatExpression from "./getDiscourseNodeFormatExpression";

const extractContentFromTitle = (
  title: string,
  node: { format: string },
): string => {
  if (!node.format) return title;
  const placeholderRegex = /{([\w\d-]+)}/g;
  const placeholders: string[] = [];
  let placeholderMatch: RegExpExecArray | null = null;
  while ((placeholderMatch = placeholderRegex.exec(node.format))) {
    placeholders.push(placeholderMatch[1]);
  }
  const expression = getDiscourseNodeFormatExpression(node.format);
  const expressionMatch = expression.exec(title);
  if (!expressionMatch || expressionMatch.length <= 1) {
    return title;
  }
  const contentIndex = placeholders.findIndex(
    (name) => name.toLowerCase() === "content",
  );
  if (contentIndex >= 0) {
    return expressionMatch[contentIndex + 1]?.trim() || title;
  }
  return expressionMatch[1]?.trim() || title;
};

export default extractContentFromTitle;
