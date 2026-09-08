import { FORMAT_PLACEHOLDER } from "@repo/database/lib/decorateTitle";

export const getDiscourseNodeFormatInnerExpression = (format: string): string =>
  `${format
    .replace(/(\[|\]|\?|\.|\+)/g, "\\$1")
    .replace(FORMAT_PLACEHOLDER, "(.*?)")}`;

const getDiscourseNodeFormatExpression = (format: string): RegExp =>
  format
    ? new RegExp(`^${getDiscourseNodeFormatInnerExpression(format)}$`, "s")
    : /$^/;

export default getDiscourseNodeFormatExpression;
