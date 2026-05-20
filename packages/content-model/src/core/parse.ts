import { DG_DOCUMENT_VERSION, NULL_INLINE_CONTENT } from "../constants";
import type {
  BodyAnnotation,
  DgDocument,
  InlineAnnotation,
  JsonObject,
} from "../schema";

type ParseDialect = "obsidian" | "roam";

type ParsedInline = {
  text: string;
  annotations: InlineAnnotation[];
};

type BlockBuildState = {
  text: string;
  annotations: BodyAnnotation[];
};

const shiftInlineAnnotations = (
  annotations: InlineAnnotation[],
  offset: number,
): InlineAnnotation[] =>
  annotations.map((annotation) => ({
    ...annotation,
    start: annotation.start + offset,
    end: annotation.end + offset,
  }));

const findClosing = (
  input: string,
  delimiter: string,
  start: number,
): number => {
  const index = input.indexOf(delimiter, start + delimiter.length);
  return index > start + delimiter.length ? index : -1;
};

const appendReference = ({
  current,
  content,
  annotation,
}: {
  current: ParsedInline;
  content: string;
  annotation: Omit<InlineAnnotation, "start" | "end">;
}): void => {
  const start = current.text.length;
  current.text += content || NULL_INLINE_CONTENT;
  const end = current.text.length;
  current.annotations.push({ ...annotation, start, end } as InlineAnnotation);
};

const parseFormatting = ({
  input,
  index,
  delimiter,
  type,
  dialect,
}: {
  input: string;
  index: number;
  delimiter: string;
  type: "bold" | "italics" | "strikethrough";
  dialect: ParseDialect;
}): { parsed: ParsedInline; nextIndex: number } | null => {
  const closing = findClosing(input, delimiter, index);
  if (closing < 0) return null;
  const inner = parseInline(input.slice(index + delimiter.length, closing), {
    dialect,
  });
  const attributes = { delimiter };
  return {
    parsed: {
      text: inner.text,
      annotations: [
        ...inner.annotations,
        {
          type,
          start: 0,
          end: inner.text.length || 1,
          attributes,
        } as InlineAnnotation,
      ],
    },
    nextIndex: closing + delimiter.length,
  };
};

export const parseInline = (
  input: string,
  { dialect }: { dialect: ParseDialect },
): ParsedInline => {
  const current: ParsedInline = { text: "", annotations: [] };
  let index = 0;

  while (index < input.length) {
    const rest = input.slice(index);

    const imageMatch = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(rest);
    if (imageMatch) {
      appendReference({
        current,
        content: imageMatch[1] || NULL_INLINE_CONTENT,
        annotation: {
          type: "image",
          attributes: {
            alt: imageMatch[1],
            src: imageMatch[2] ?? "",
          },
        },
      });
      index += imageMatch[0].length;
      continue;
    }

    const linkMatch = /^\[([^\]]*)\]\(([^)]+)\)/.exec(rest);
    if (linkMatch) {
      appendReference({
        current,
        content: linkMatch[1] || NULL_INLINE_CONTENT,
        annotation: {
          type: "link",
          attributes: {
            href: linkMatch[2] ?? "",
          },
        },
      });
      index += linkMatch[0].length;
      continue;
    }

    const wikiMatch = /^\[\[([^\]]+)\]\]/.exec(rest);
    if (wikiMatch) {
      const rawTarget = wikiMatch[1] ?? "";
      const [pathWithSubpath = "", alias] = rawTarget.split("|");
      const subpathIndex = pathWithSubpath.search(/[#^]/);
      const path =
        subpathIndex >= 0
          ? pathWithSubpath.slice(0, subpathIndex)
          : pathWithSubpath;
      const subpath =
        subpathIndex >= 0 ? pathWithSubpath.slice(subpathIndex) : undefined;
      appendReference({
        current,
        content:
          dialect === "obsidian"
            ? alias || pathWithSubpath || NULL_INLINE_CONTENT
            : NULL_INLINE_CONTENT,
        annotation:
          dialect === "obsidian"
            ? {
                type: "reference",
                attributes: {
                  kind: "obsidian-wikilink",
                  path,
                  subpath,
                  alias,
                },
              }
            : {
                type: "reference",
                attributes: {
                  kind: "roam-page",
                  pageTitle: rawTarget,
                },
              },
      });
      index += wikiMatch[0].length;
      continue;
    }

    if (dialect === "roam") {
      const blockRefMatch = /^\(\(([^)]+)\)\)/.exec(rest);
      if (blockRefMatch) {
        appendReference({
          current,
          content: NULL_INLINE_CONTENT,
          annotation: {
            type: "reference",
            attributes: {
              kind: "roam-block",
              blockUid: blockRefMatch[1] ?? "",
            },
          },
        });
        index += blockRefMatch[0].length;
        continue;
      }

      const hashMatch = /^#([a-zA-Z0-9_.-]+)/.exec(rest);
      if (hashMatch) {
        appendReference({
          current,
          content: NULL_INLINE_CONTENT,
          annotation: {
            type: "reference",
            attributes: {
              kind: "roam-page",
              pageTitle: hashMatch[1] ?? "",
            },
            appAttributes: {
              roam: { kind: "hash" },
            },
          },
        });
        index += hashMatch[0].length;
        continue;
      }
    }

    const inlineCodeMatch = /^`([^`\n]+)`/.exec(rest);
    if (inlineCodeMatch) {
      appendReference({
        current,
        content: inlineCodeMatch[1] ?? "",
        annotation: {
          type: "code",
          attributes: {
            display: "inline",
          },
        },
      });
      index += inlineCodeMatch[0].length;
      continue;
    }

    const formattingCandidates: Array<{
      delimiter: string;
      type: "bold" | "italics" | "strikethrough";
    }> =
      dialect === "roam"
        ? [
            { delimiter: "**", type: "bold" },
            { delimiter: "__", type: "italics" },
            { delimiter: "~~", type: "strikethrough" },
          ]
        : [
            { delimiter: "**", type: "bold" },
            { delimiter: "__", type: "bold" },
            { delimiter: "~~", type: "strikethrough" },
            { delimiter: "_", type: "italics" },
            { delimiter: "*", type: "italics" },
          ];

    const parsedFormatting = formattingCandidates
      .filter(({ delimiter }) => rest.startsWith(delimiter))
      .map(({ delimiter, type }) =>
        parseFormatting({ input, index, delimiter, type, dialect }),
      )
      .find((result): result is NonNullable<typeof result> => result !== null);

    if (parsedFormatting) {
      current.text += parsedFormatting.parsed.text;
      current.annotations.push(
        ...shiftInlineAnnotations(
          parsedFormatting.parsed.annotations,
          current.text.length - parsedFormatting.parsed.text.length,
        ),
      );
      index = parsedFormatting.nextIndex;
      continue;
    }

    current.text += input[index];
    index++;
  }

  return current;
};

export const stripYamlFrontmatter = (
  markdown: string,
): { frontmatter: string | null; body: string } => {
  if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) {
    return { frontmatter: null, body: markdown };
  }
  const normalized = markdown.replace(/\r\n/g, "\n");
  const closing = normalized.indexOf("\n---\n", 4);
  if (closing < 0) {
    return { frontmatter: null, body: markdown };
  }
  return {
    frontmatter: normalized.slice(4, closing),
    body: normalized.slice(closing + "\n---\n".length),
  };
};

const getBlockLineParts = (
  line: string,
): {
  depth: number;
  viewType: "paragraph" | "bullet" | "numbered";
  text: string;
} => {
  const match = /^((?:\t| {2,4})*)(?:(- )|(\d+\. ))?(.*)$/.exec(line);
  const indent = match?.[1] ?? "";
  const depth =
    Array.from(indent.matchAll(/\t| {2,4}/g)).length > 0
      ? Array.from(indent.matchAll(/\t| {2,4}/g)).length
      : 0;
  const viewType = match?.[2]
    ? "bullet"
    : match?.[3]
      ? "numbered"
      : "paragraph";
  return {
    depth,
    viewType,
    text: match?.[4] ?? line,
  };
};

export const parseMarkdownBody = ({
  markdown,
  dialect,
  blockIdPrefix,
}: {
  markdown: string;
  dialect: ParseDialect;
  blockIdPrefix: string;
}): BlockBuildState => {
  const state: BlockBuildState = { text: "", annotations: [] };
  const parentByDepth = new Map<number, string>();
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex] ?? "";
    if (line.trim() === "") {
      lineIndex++;
      continue;
    }

    const codeFenceMatch = /^```([\w -]*)$/.exec(line.trim());
    if (codeFenceMatch) {
      const codeStartLine = lineIndex + 1;
      const codeLines: string[] = [];
      lineIndex++;
      while (lineIndex < lines.length && lines[lineIndex]?.trim() !== "```") {
        codeLines.push(lines[lineIndex] ?? "");
        lineIndex++;
      }
      if (lineIndex < lines.length) lineIndex++;
      const blockId = `${blockIdPrefix}-${codeStartLine}`;
      const start = state.text.length;
      const codeText = `${codeLines.join("\n")}\n`;
      state.text += codeText;
      const end = state.text.length;
      state.annotations.push({
        type: "block",
        start,
        end,
        attributes: {
          blockId,
          depth: 0,
          viewType: "paragraph",
        },
      });
      state.annotations.push({
        type: "code",
        start,
        end: Math.max(start + 1, end - 1),
        attributes: {
          display: "block",
          language: codeFenceMatch[1] || undefined,
          ticks: 3,
        },
      });
      continue;
    }

    const blockParts = getBlockLineParts(line);
    const parsedInline = parseInline(blockParts.text, { dialect });
    const blockId = `${blockIdPrefix}-${lineIndex + 1}`;
    const parentBlockId =
      blockParts.depth > 0
        ? parentByDepth.get(blockParts.depth - 1)
        : undefined;
    const start = state.text.length;
    state.text += `${parsedInline.text}\n`;
    const end = state.text.length;
    state.annotations.push({
      type: "block",
      start,
      end,
      attributes: {
        blockId,
        parentBlockId,
        depth: blockParts.depth,
        viewType: blockParts.viewType,
      },
    });
    state.annotations.push(
      ...shiftInlineAnnotations(parsedInline.annotations, start),
    );
    parentByDepth.set(blockParts.depth, blockId);
    for (const depth of Array.from(parentByDepth.keys())) {
      if (depth > blockParts.depth) parentByDepth.delete(depth);
    }
    lineIndex++;
  }

  return state;
};

export const createDgDocument = ({
  title,
  body,
  titleAnnotations = [],
  bodyAnnotations,
  metadata,
}: {
  title: string;
  body: string;
  titleAnnotations?: InlineAnnotation[];
  bodyAnnotations: BodyAnnotation[];
  metadata?: JsonObject;
}): DgDocument => ({
  version: DG_DOCUMENT_VERSION,
  title: {
    text: title,
    annotations: titleAnnotations,
  },
  body: {
    text: body,
    annotations: bodyAnnotations,
  },
  metadata,
});
