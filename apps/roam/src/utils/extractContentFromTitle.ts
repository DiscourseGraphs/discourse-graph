import getDiscourseNodeFormatExpression from "./getDiscourseNodeFormatExpression";

// The text a node's title holds in a given placeholder of its node type's format:
// extractFieldFromTitle("[[EVD]] - a claim - [[@ref]]", evidence, "source") is
// "[[@ref]]".
export const extractFieldFromTitle = (
  title: string,
  node: { format: string },
  field: string,
): string | undefined => {
  if (!node.format) return undefined;
  const placeholderRegex = /{([\w\d-]+)}/g;
  const placeholders: string[] = [];
  let placeholderMatch: RegExpExecArray | null = null;
  while ((placeholderMatch = placeholderRegex.exec(node.format))) {
    placeholders.push(placeholderMatch[1]);
  }
  const expression = getDiscourseNodeFormatExpression(node.format);
  const expressionMatch = expression.exec(title);
  if (!expressionMatch || expressionMatch.length <= 1) {
    return undefined;
  }
  const contentIndex = placeholders.findIndex(
    (name) => name.toLowerCase() === field,
  );
  if (contentIndex >= 0) return expressionMatch[contentIndex + 1]?.trim();
};

const extractContentFromTitle = (
  title: string,
  node: { format: string },
): string => extractFieldFromTitle(title, node, "content") || title;

export default extractContentFromTitle;
