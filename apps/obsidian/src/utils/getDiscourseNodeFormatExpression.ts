export const getDiscourseNodeFormatExpression = (format: string) =>
  format
    ? new RegExp(
        `^${format
          .replace(/(\[|\]|\?|\.|\+)/g, "\\$1")
          .replace(/{[a-zA-Z]+}/g, "(.*?)")}$`,
        "s",
      )
    : /$^/;
