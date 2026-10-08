// Replaces the frontmatter splitting `gray-matter` did. That package requires
// Node's `fs` at module load, so it cannot run on Obsidian mobile. Kept free of
// any `obsidian` import so it stays a pure, directly testable function; callers
// pass the returned YAML to Obsidian's own `parseYaml`.
const FRONTMATTER_BLOCK =
  /^---[ \t]*\r?\n([\s\S]*?)\r?\n?^---[ \t]*(?:\r?\n|$)/m;

export type SplitFrontmatter = {
  /** Raw YAML source, or null when the content has no frontmatter block. */
  yaml: string | null;
  body: string;
};

export const splitFrontmatter = (content: string): SplitFrontmatter => {
  const match = FRONTMATTER_BLOCK.exec(content);
  // The block only counts as frontmatter at the very start of the file;
  // a `---` further down is a horizontal rule.
  if (!match || match.index !== 0) return { yaml: null, body: content };
  return { yaml: match[1] ?? "", body: content.slice(match[0].length) };
};
