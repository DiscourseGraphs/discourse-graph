export type ChangelogPreflightResult =
  | { status: "valid" }
  | { status: "missing" }
  | { status: "empty" };

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasReleaseNoteContent = (section: string): boolean =>
  section.split("\n").some((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return false;
    if (/^#{3,6}\s+/.test(trimmedLine)) return false;
    if (/^<!--.*-->$/.test(trimmedLine)) return false;
    return true;
  });

export const checkChangelogSection = ({
  changelog,
  version,
}: {
  changelog: string;
  version: string;
}): ChangelogPreflightResult => {
  const headingPattern = new RegExp(
    `^##\\s+\\[${escapeRegExp(version)}\\](?:\\s+-\\s+.*)?\\s*$`,
    "m",
  );
  const headingMatch = headingPattern.exec(changelog);
  if (!headingMatch) return { status: "missing" };

  const sectionStart = headingMatch.index + headingMatch[0].length;
  const remainingChangelog = changelog.slice(sectionStart);
  const nextSectionIndex = remainingChangelog.search(/^##\s+/m);
  const section =
    nextSectionIndex === -1
      ? remainingChangelog
      : remainingChangelog.slice(0, nextSectionIndex);

  return hasReleaseNoteContent(section)
    ? { status: "valid" }
    : { status: "empty" };
};
