import { FORMAT_PLACEHOLDER } from "@repo/database/lib/decorateTitle";

export const getDiscourseNodeFormatExpression = (format: string) =>
  format
    ? new RegExp(
        `^${format
          .replace(/(\[|\]|\?|\.|\+)/g, "\\$1")
          .replace(FORMAT_PLACEHOLDER, "(.*?)")}$`,
        "s",
      )
    : /$^/;
