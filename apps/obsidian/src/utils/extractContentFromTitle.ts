import { getDiscourseNodeFormatExpression } from "./getDiscourseNodeFormatExpression";

export const extractContentFromTitle = (format: string, title: string): string => {
  if (!format) return title;

  const regex = getDiscourseNodeFormatExpression(format);
  const match = title.match(regex);

  return match?.[1]?.trim() || title;
};
