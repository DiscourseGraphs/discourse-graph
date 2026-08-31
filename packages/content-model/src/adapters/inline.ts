import {
  createDelimitedInlineRule,
  parseInlineText,
  renderInlineText,
  type InlineParseRule,
  type ParsedInlineText,
} from "../core";
import type { DgInlineAnnotation, DgReferenceAnnotation } from "../schema";

const createRegexRule = ({
  pattern,
  getContent,
  createAnnotation,
  parseContent = false,
}: {
  pattern: RegExp;
  getContent: (match: RegExpExecArray) => string;
  createAnnotation: (
    match: RegExpExecArray,
    range: { start: number; end: number },
  ) => DgInlineAnnotation;
  parseContent?: boolean;
}): InlineParseRule => {
  return ({ source, index }) => {
    const match = pattern.exec(source.slice(index));
    if (match === null || match.index !== 0) return null;
    return {
      length: match[0].length,
      content: getContent(match),
      parseContent,
      createAnnotation: (range) => createAnnotation(match, range),
    };
  };
};

const getRequiredCapture = (match: RegExpExecArray, index: number): string =>
  match[index] ?? "";

const createReference = ({
  referenceType,
  target,
  label,
  transclusion,
  start,
  end,
}: Omit<DgReferenceAnnotation, "type">): DgReferenceAnnotation => ({
  type: "reference",
  referenceType,
  target,
  ...(label === undefined ? {} : { label }),
  ...(transclusion === undefined ? {} : { transclusion }),
  start,
  end,
});

const escapedCharacterRule: InlineParseRule = ({ source, index }) => {
  if (source[index] !== "\\" || index + 1 >= source.length) return null;
  return { length: 2, content: source[index + 1] ?? "" };
};

const imageWikiLinkRule = createRegexRule({
  pattern: /^!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/,
  getContent: (match) =>
    getRequiredCapture(match, 2) || getRequiredCapture(match, 1),
  createAnnotation: (match, range) =>
    createReference({
      referenceType: "image",
      target: getRequiredCapture(match, 1),
      label: match[2],
      transclusion: true,
      ...range,
    }),
});

const wikiLinkRule = createRegexRule({
  pattern: /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/,
  getContent: (match) =>
    getRequiredCapture(match, 2) || getRequiredCapture(match, 1),
  createAnnotation: (match, range) =>
    createReference({
      referenceType: "page",
      target: getRequiredCapture(match, 1),
      label: match[2],
      ...range,
    }),
});

const markdownImageRule = createRegexRule({
  pattern: /^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/,
  getContent: (match) =>
    getRequiredCapture(match, 1) || getRequiredCapture(match, 2),
  createAnnotation: (match, range) =>
    createReference({
      referenceType: "image",
      target: getRequiredCapture(match, 2),
      label: match[1],
      transclusion: true,
      ...range,
    }),
});

const markdownLinkRule = createRegexRule({
  pattern: /^\[([^\]]+)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/,
  getContent: (match) => getRequiredCapture(match, 1),
  parseContent: true,
  createAnnotation: (match, range) => ({
    type: "link",
    href: getRequiredCapture(match, 2),
    ...(match[3] === undefined ? {} : { title: match[3] }),
    ...range,
  }),
});

const tagRule: InlineParseRule = ({ source, index }) => {
  const previous = index === 0 ? " " : (source[index - 1] ?? "");
  if (!/\s|[([{]/.test(previous)) return null;
  const match = /^#([\p{L}\p{N}_/-]+)/u.exec(source.slice(index));
  if (match === null) return null;
  const target = getRequiredCapture(match, 1);
  return {
    length: match[0].length,
    content: target,
    createAnnotation: (range) =>
      createReference({ referenceType: "tag", target, ...range }),
  };
};

export const markdownInlineRules: readonly InlineParseRule[] = [
  escapedCharacterRule,
  imageWikiLinkRule,
  wikiLinkRule,
  markdownImageRule,
  markdownLinkRule,
  createDelimitedInlineRule({
    delimiter: "`",
    type: "inline-code",
    parseContent: false,
  }),
  createDelimitedInlineRule({ delimiter: "**", type: "bold" }),
  createDelimitedInlineRule({ delimiter: "__", type: "bold" }),
  createDelimitedInlineRule({ delimiter: "~~", type: "strikethrough" }),
  createDelimitedInlineRule({ delimiter: "*", type: "italic" }),
  createDelimitedInlineRule({ delimiter: "_", type: "italic" }),
  tagRule,
];

export const parseMarkdownInline = (source: string): ParsedInlineText =>
  parseInlineText({ source, rules: markdownInlineRules });

const escapeMarkdownTarget = (target: string): string =>
  target.replaceAll("\\", "\\\\").replaceAll(")", "\\)");

const annotationOpen = (annotation: DgInlineAnnotation): string => {
  switch (annotation.type) {
    case "bold":
      return "**";
    case "italic":
      return "*";
    case "strikethrough":
      return "~~";
    case "inline-code":
      return "`";
    case "link":
      return "[";
    case "reference":
      if (annotation.referenceType === "image")
        return `![[${annotation.target}|`;
      if (annotation.referenceType === "tag") return "#";
      return `[[${annotation.target}|`;
  }
};

const annotationClose = (annotation: DgInlineAnnotation): string => {
  switch (annotation.type) {
    case "bold":
      return "**";
    case "italic":
      return "*";
    case "strikethrough":
      return "~~";
    case "inline-code":
      return "`";
    case "link":
      return `](${escapeMarkdownTarget(annotation.href)}${
        annotation.title === undefined ? "" : ` "${annotation.title}"`
      })`;
    case "reference": {
      if (annotation.referenceType === "tag") return "";
      return "]]";
    }
  }
};

export const renderObsidianInline = (value: ParsedInlineText): string =>
  renderInlineText({
    value,
    renderer: { open: annotationOpen, close: annotationClose },
  });
