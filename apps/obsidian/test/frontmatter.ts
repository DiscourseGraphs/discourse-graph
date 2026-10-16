import { parse, stringify } from "yaml";
import { splitFrontmatter } from "~/utils/splitFrontmatter";

type TestNote = {
  frontmatter: Record<string, unknown>;
  body: string;
};

export const parseTestNote = (content: string): TestNote => {
  const { yaml, body } = splitFrontmatter(content);
  if (yaml === null) return { frontmatter: {}, body };
  try {
    const frontmatter = parse(yaml) as Record<string, unknown> | null;
    return { frontmatter: frontmatter ?? {}, body };
  } catch {
    return { frontmatter: {}, body };
  }
};

export const serializeTestNote = (
  body: string,
  frontmatter: Record<string, unknown>,
): string => `---\n${stringify(frontmatter)}---\n${body}`;
