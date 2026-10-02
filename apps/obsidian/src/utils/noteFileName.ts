// Titles arrive from other apps in their own syntax: Roam node titles carry page
// references ([[EVD]] - x - [[@Smith 2020]]) and tags. Obsidian creates a file with
// those characters in its name but cannot link to it, so references are unwrapped
// to keep the page name and the rest of the link characters (#^[]|, the set
// checkInvalidChars enforces on node type formats) are dropped with the OS set.
// A slash is dropped rather than made a folder: a Roam namespace and an Obsidian
// folder are not the same thing. Returns "" when nothing survives; the caller
// picks the fallback name.
const PAGE_REFERENCE = /\[\[([^\]]*)\]\]/g;
const REJECTED_IN_FILE_NAMES = /[<>:"/\\|?*#^[\]]/g;

export const noteFileNameFromTitle = (title: string): string =>
  title
    .replace(PAGE_REFERENCE, "$1")
    .replace(REJECTED_IN_FILE_NAMES, "")
    .replace(/\s+/g, " ")
    .trim();
