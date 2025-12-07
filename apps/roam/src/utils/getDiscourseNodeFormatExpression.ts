export const getDiscourseNodeFormatInnerExpression = (format: string): string =>
  `${format
    .replace(/(\[|\]|\?|\.|\+)/g, "\\$1")
    .replace(/{[a-zA-Z]+}/g, "(.*?)")}`;

const getDiscourseNodeFormatExpression = (format: string): RegExp =>
  format
    ? new RegExp(`^${getDiscourseNodeFormatInnerExpression(format)}$`, "s")
    : /$^/;

export default getDiscourseNodeFormatExpression;
