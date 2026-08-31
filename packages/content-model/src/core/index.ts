import type {
  DgAnnotation,
  DgInlineAnnotation,
  DgSpan,
  DgText,
  DgTextStyleAnnotation,
} from "../schema";

export type TextRange = DgSpan;

export const isValidTextRange = ({ start, end }: TextRange): boolean =>
  Number.isInteger(start) &&
  Number.isInteger(end) &&
  start >= 0 &&
  end >= start;

export type InlineRuleMatch = {
  length: number;
  content: string;
  parseContent?: boolean;
  createAnnotation?: (range: DgSpan) => DgInlineAnnotation;
};

export type InlineParseRule = ({
  source,
  index,
}: {
  source: string;
  index: number;
}) => InlineRuleMatch | null;

export type ParsedInlineText = {
  text: string;
  annotations: DgInlineAnnotation[];
};

const offsetInlineAnnotations = ({
  annotations,
  offset,
}: {
  annotations: readonly DgInlineAnnotation[];
  offset: number;
}): DgInlineAnnotation[] =>
  annotations.map((annotation) => ({
    ...annotation,
    start: annotation.start + offset,
    end: annotation.end + offset,
  }));

export const parseInlineText = ({
  source,
  rules,
}: {
  source: string;
  rules: readonly InlineParseRule[];
}): ParsedInlineText => {
  let text = "";
  const annotations: DgInlineAnnotation[] = [];
  let index = 0;

  while (index < source.length) {
    const match = rules
      .map((rule) => rule({ source, index }))
      .find((candidate): candidate is InlineRuleMatch => candidate !== null);

    if (match === undefined || match.length <= 0) {
      text += source[index];
      index += 1;
      continue;
    }

    const start = text.length;
    if (match.parseContent) {
      const nested = parseInlineText({ source: match.content, rules });
      text += nested.text;
      annotations.push(
        ...offsetInlineAnnotations({
          annotations: nested.annotations,
          offset: start,
        }),
      );
    } else {
      text += match.content;
    }
    const end = text.length;
    if (match.createAnnotation !== undefined) {
      annotations.push(match.createAnnotation({ start, end }));
    }
    index += match.length;
  }

  return { text, annotations };
};

export const createDelimitedInlineRule = ({
  delimiter,
  type,
  parseContent = true,
}: {
  delimiter: string;
  type: DgTextStyleAnnotation["type"];
  parseContent?: boolean;
}): InlineParseRule => {
  return ({ source, index }): InlineRuleMatch | null => {
    if (!source.startsWith(delimiter, index)) return null;
    const contentStart = index + delimiter.length;
    const contentEnd = source.indexOf(delimiter, contentStart);
    if (contentEnd < contentStart) return null;

    return {
      length: contentEnd + delimiter.length - index,
      content: source.slice(contentStart, contentEnd),
      parseContent,
      createAnnotation: ({ start, end }) => ({ type, start, end }),
    };
  };
};

const DEFAULT_ANNOTATION_ORDER: readonly DgInlineAnnotation["type"][] = [
  "link",
  "reference",
  "bold",
  "italic",
  "strikethrough",
  "inline-code",
];

export const sortInlineAnnotationsForRender = ({
  annotations,
  annotationOrder = DEFAULT_ANNOTATION_ORDER,
}: {
  annotations: readonly DgInlineAnnotation[];
  annotationOrder?: readonly DgInlineAnnotation["type"][];
}): DgInlineAnnotation[] => {
  const priority = new Map(annotationOrder.map((type, index) => [type, index]));
  return [...annotations].sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start;
    if (left.end !== right.end) return right.end - left.end;
    return (
      (priority.get(left.type) ?? Number.MAX_SAFE_INTEGER) -
      (priority.get(right.type) ?? Number.MAX_SAFE_INTEGER)
    );
  });
};

export type InlineAnnotationRenderer = {
  open: (annotation: DgInlineAnnotation) => string;
  close: (annotation: DgInlineAnnotation) => string;
};

const annotationsAreEqual = (
  left: DgInlineAnnotation,
  right: DgInlineAnnotation,
): boolean => left === right;

export const renderInlineText = ({
  value,
  renderer,
  escapeText = (text): string => text,
  annotationOrder,
}: {
  value: ParsedInlineText;
  renderer: InlineAnnotationRenderer;
  escapeText?: (text: string) => string;
  annotationOrder?: readonly DgInlineAnnotation["type"][];
}): string => {
  const annotations = sortInlineAnnotationsForRender({
    annotations: value.annotations.filter(
      ({ start, end }) =>
        isValidTextRange({ start, end }) &&
        start < end &&
        end <= value.text.length,
    ),
    annotationOrder,
  });
  const boundaries = [
    ...new Set([
      0,
      value.text.length,
      ...annotations.flatMap(({ start, end }) => [start, end]),
    ]),
  ].sort((left, right) => left - right);
  let result = "";
  let openAnnotations: DgInlineAnnotation[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (start === undefined || end === undefined || start === end) continue;

    const activeAnnotations = annotations.filter(
      (annotation) => annotation.start <= start && annotation.end >= end,
    );
    let sharedPrefixLength = 0;
    while (
      sharedPrefixLength < openAnnotations.length &&
      sharedPrefixLength < activeAnnotations.length &&
      annotationsAreEqual(
        openAnnotations[sharedPrefixLength] as DgInlineAnnotation,
        activeAnnotations[sharedPrefixLength] as DgInlineAnnotation,
      )
    ) {
      sharedPrefixLength += 1;
    }

    for (
      let closeIndex = openAnnotations.length - 1;
      closeIndex >= sharedPrefixLength;
      closeIndex -= 1
    ) {
      result += renderer.close(
        openAnnotations[closeIndex] as DgInlineAnnotation,
      );
    }
    for (
      let openIndex = sharedPrefixLength;
      openIndex < activeAnnotations.length;
      openIndex += 1
    ) {
      result += renderer.open(
        activeAnnotations[openIndex] as DgInlineAnnotation,
      );
    }
    result += escapeText(value.text.slice(start, end));
    openAnnotations = activeAnnotations;
  }

  for (let index = openAnnotations.length - 1; index >= 0; index -= 1) {
    result += renderer.close(openAnnotations[index] as DgInlineAnnotation);
  }
  return result;
};

const transformAnnotationForReplacement = <T extends DgAnnotation>({
  annotation,
  range,
  replacementLength,
}: {
  annotation: T;
  range: DgSpan;
  replacementLength: number;
}): T | null => {
  const delta = replacementLength - (range.end - range.start);
  if (annotation.end <= range.start) return annotation;
  if (annotation.start >= range.end) {
    return {
      ...annotation,
      start: annotation.start + delta,
      end: annotation.end + delta,
    };
  }
  if (annotation.start >= range.start && annotation.end <= range.end) {
    return null;
  }
  if (annotation.start <= range.start && annotation.end >= range.end) {
    return { ...annotation, end: annotation.end + delta };
  }
  if (annotation.start < range.start) {
    return { ...annotation, end: range.start + replacementLength };
  }
  return {
    ...annotation,
    start: range.start,
    end: annotation.end + delta,
  };
};

export const replaceTextRange = ({
  value,
  range,
  replacement,
}: {
  value: DgText;
  range: DgSpan;
  replacement: string;
}): DgText => {
  if (!isValidTextRange(range) || range.end > value.text.length) {
    throw new RangeError("Replacement range is outside the text value.");
  }

  return {
    text:
      value.text.slice(0, range.start) +
      replacement +
      value.text.slice(range.end),
    annotations: value.annotations.flatMap((annotation) => {
      const transformed = transformAnnotationForReplacement({
        annotation,
        range,
        replacementLength: replacement.length,
      });
      return transformed === null ? [] : [transformed];
    }),
  };
};
