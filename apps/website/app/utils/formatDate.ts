// Dates from blog frontmatter are date-only values; formatting in UTC keeps
// the displayed day stable regardless of the server's local timezone.
export const formatDisplayDate = (isoDate: string): string =>
  new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
