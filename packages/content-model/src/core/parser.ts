import type {
  BodyAnnotation,
  InlineAnnotation,
  ReferenceAnnotation,
  TextDocument,
} from "../schema";
import { offsetAnnotations } from "./annotations";

type TokenMatch = {
  start: number;
  end: number;
  text: string;
  annotation: InlineAnnotation;
};

const TOKEN_PATTERNS: Array<{
  regex: RegExp;
  build: (match: RegExpExecArray) => TokenMatch | null;
}> = [
  {
    regex: /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g,
    build: (match) => {
      const alt = match[1] ?? "";
      const src = match[2] ?? "";
      const text = alt || src;
      return {
        start: match.index,
        end: match.index + match[0].length,
        text,
        annotation: {
          type: "image",
          start: 0,
          end: text.length,
          attributes: {
            src,
            ...(alt ? { alt } : {}),
            ...(match[3] ? { title: match[3] } : {}),
          },
        },
      };
    },
  },
  {
    regex: /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g,
    build: (match) => {
      const text = match[1] ?? "";
      const href = match[2] ?? "";
      return {
        start: match.index,
        end: match.index + match[0].length,
        text,
        annotation: {
          type: "link",
          start: 0,
          end: text.length,
          attributes: {
            href,
            ...(match[3] ? { title: match[3] } : {}),
          },
        },
      };
    },
  },
  {
    regex: /\[\[([^\]|#^]+)(#[^\]|^]+)?(\^[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
    build: (match) => {
      const path = match[1] ?? "";
      const alias = match[4];
      const text = alias || path;
      const annotation: ReferenceAnnotation = {
        type: "reference",
        start: 0,
        end: text.length,
        attributes: {
          kind: "obsidian-wikilink",
          path,
          ...(match[2] || match[3]
            ? { subpath: `${match[2] ?? ""}${match[3] ?? ""}` }
            : {}),
          ...(alias ? { alias } : {}),
        },
      };
      return {
        start: match.index,
        end: match.index + match[0].length,
        text,
        annotation,
      };
    },
  },
  {
    regex: /\(\(([A-Za-z0-9_-]{6,})\)\)/g,
    build: (match) => {
      const blockUid = match[1] ?? "";
      return {
        start: match.index,
        end: match.index + match[0].length,
        text: blockUid,
        annotation: {
          type: "reference",
          start: 0,
          end: blockUid.length,
          attributes: {
            kind: "roam-block",
            blockUid,
          },
        },
      };
    },
  },
  {
    regex: /#\[\[([^\]]+)\]\]/g,
    build: (match) => {
      const pageTitle = match[1] ?? "";
      return {
        start: match.index,
        end: match.index + match[0].length,
        text: pageTitle,
        annotation: {
          type: "reference",
          start: 0,
          end: pageTitle.length,
          attributes: {
            kind: "roam-page",
            pageTitle,
          },
          appAttributes: { roam: { kind: "hash-wikilink" } },
        },
      };
    },
  },
  {
    regex: /\[\[([^\]]+)\]\]/g,
    build: (match) => {
      const pageTitle = match[1] ?? "";
      return {
        start: match.index,
        end: match.index + match[0].length,
        text: pageTitle,
        annotation: {
          type: "reference",
          start: 0,
          end: pageTitle.length,
          attributes: {
            kind: "roam-page",
            pageTitle,
          },
          appAttributes: { roam: { kind: "wikilink" } },
        },
      };
    },
  },
  {
    regex: /(^|\s)#([A-Za-z0-9_.-]+)/g,
    build: (match) => {
      const prefix = match[1] ?? "";
      const pageTitle = match[2] ?? "";
      return {
        start: match.index,
        end: match.index + match[0].length,
        text: `${prefix}${pageTitle}`,
        annotation: {
          type: "reference",
          start: prefix.length,
          end: prefix.length + pageTitle.length,
          attributes: {
            kind: "roam-page",
            pageTitle,
          },
          appAttributes: { roam: { kind: "hash" } },
        },
      };
    },
  },
];

const INLINE_STYLE_PATTERNS: Array<{
  regex: RegExp;
  type: "bold" | "italics" | "strikethrough" | "code";
  delimiter: string;
}> = [
  { regex: /\*\*([^*]+)\*\*/g, type: "bold", delimiter: "**" },
  { regex: /__([^_]+)__/g, type: "bold", delimiter: "__" },
  { regex: /~~([^~]+)~~/g, type: "strikethrough", delimiter: "~~" },
  { regex: /`([^`]+)`/g, type: "code", delimiter: "`" },
  { regex: /\*([^*\s][^*]*?)\*/g, type: "italics", delimiter: "*" },
  { regex: /_([^_\s][^_]*?)_/g, type: "italics", delimiter: "_" },
];

const findNextToken = (input: string, startAt: number): TokenMatch | null => {
  let best: TokenMatch | null = null;
  for (const pattern of TOKEN_PATTERNS) {
    pattern.regex.lastIndex = startAt;
    const match = pattern.regex.exec(input);
    if (!match) continue;
    const built = pattern.build(match);
    if (!built) continue;
    if (!best || built.start < best.start) {
      best = built;
    }
  }
  return best;
};

const parseAtomicTokens = (input: string): TextDocument => {
  let cursor = 0;
  let text = "";
  const annotations: InlineAnnotation[] = [];

  while (cursor < input.length) {
    const token = findNextToken(input, cursor);
    if (!token) {
      text += input.slice(cursor);
      break;
    }
    if (token.start > cursor) {
      text += input.slice(cursor, token.start);
    }
    const offset = text.length;
    text += token.text;
    annotations.push(...offsetAnnotations([token.annotation], offset));
    cursor = token.end;
  }

  return { text, annotations };
};

export const parseInlineText = (input: string): TextDocument => {
  const atomic = parseAtomicTokens(input);
  let output = atomic.text;
  const annotations: InlineAnnotation[] = atomic.annotations;

  for (const pattern of INLINE_STYLE_PATTERNS) {
    const matches = [...output.matchAll(pattern.regex)];
    let removed = 0;
    for (const match of matches) {
      const full = match[0];
      const inner = match[1] ?? "";
      const originalStart = match.index ?? 0;
      const start = originalStart - removed;
      const markerLength = pattern.delimiter.length;
      output = `${output.slice(0, start)}${inner}${output.slice(
        start + full.length,
      )}`;
      const end = start + inner.length;
      for (const annotation of annotations) {
        if (annotation.start >= start + full.length) {
          annotation.start -= markerLength * 2;
          annotation.end -= markerLength * 2;
        } else if (annotation.start >= start + markerLength) {
          annotation.start -= markerLength;
          annotation.end -= markerLength;
        }
      }
      annotations.push(
        pattern.type === "code"
          ? {
              type: "code",
              start,
              end,
              attributes: { display: "inline" },
            }
          : {
              type: pattern.type,
              start,
              end,
              attributes: { delimiter: pattern.delimiter },
            },
      );
      removed += markerLength * 2;
    }
  }

  return {
    text: output,
    annotations,
  };
};

export const mergeTextDocuments = (
  documents: TextDocument[],
  separator = "",
): TextDocument => {
  let text = "";
  const annotations: InlineAnnotation[] = [];
  documents.forEach((document, index) => {
    if (index > 0) text += separator;
    const offset = text.length;
    text += document.text;
    annotations.push(...offsetAnnotations(document.annotations, offset));
  });
  return { text, annotations };
};

export const getInlineAnnotations = (
  annotations: BodyAnnotation[],
): InlineAnnotation[] =>
  annotations.filter(
    (annotation): annotation is InlineAnnotation => annotation.type !== "block",
  );
