import { NULL_INLINE_CONTENT } from "../constants";
import type {
  BodyAnnotation,
  ImageAnnotation,
  InlineAnnotation,
  LinkAnnotation,
  ReferenceAnnotation,
} from "../schema";

type AppliedAnnotation = {
  prefix: string;
  suffix: string;
  replace?: boolean;
};

type AnnotationRenderer<T extends InlineAnnotation> = (args: {
  annotation: T;
  content: string;
  index: number;
}) => AppliedAnnotation;

type RendererMap = {
  [K in InlineAnnotation["type"]]?: AnnotationRenderer<
    Extract<InlineAnnotation, { type: K }>
  >;
};

const shiftRemainingAnnotations = ({
  annotations,
  startIndex,
  start,
  end,
  prefixLength,
  suffixLength,
  replacedLength,
}: {
  annotations: Array<{ annotation: InlineAnnotation; index: number }>;
  startIndex: number;
  start: number;
  end: number;
  prefixLength: number;
  suffixLength: number;
  replacedLength: number;
}): void => {
  for (const item of annotations.slice(startIndex + 1)) {
    if (item.annotation.start >= start) item.annotation.start += prefixLength;
    if (item.annotation.start >= end) {
      item.annotation.start += suffixLength - replacedLength;
    }
    if (item.annotation.end > start) item.annotation.end += prefixLength;
    if (item.annotation.end > end) {
      item.annotation.end += suffixLength - replacedLength;
    }
  }
};

export const renderAnnotatedText = ({
  text,
  annotations,
  renderers,
}: {
  text: string;
  annotations: InlineAnnotation[];
  renderers: RendererMap;
}): string => {
  const sorted = annotations
    .map((annotation, index) => ({ annotation: { ...annotation }, index }))
    .sort((a, b) => {
      const aSize = a.annotation.end - a.annotation.start;
      const bSize = b.annotation.end - b.annotation.start;
      return bSize - aSize || a.index - b.index;
    });

  return sorted.reduce((content, item, index) => {
    const renderer = renderers[item.annotation.type] as
      | AnnotationRenderer<InlineAnnotation>
      | undefined;
    if (!renderer) return content;

    const annotatedContent = content.slice(
      item.annotation.start,
      item.annotation.end,
    );
    const applied = renderer({
      annotation: item.annotation,
      content: annotatedContent,
      index: item.index,
    });
    const replacementLength = applied.replace ? annotatedContent.length : 0;
    shiftRemainingAnnotations({
      annotations: sorted,
      startIndex: index,
      start: item.annotation.start,
      end: item.annotation.end,
      prefixLength: applied.prefix.length,
      suffixLength: applied.suffix.length,
      replacedLength: replacementLength,
    });
    return `${content.slice(0, item.annotation.start)}${applied.prefix}${
      applied.replace ? "" : annotatedContent
    }${applied.suffix}${content.slice(item.annotation.end)}`;
  }, text);
};

const shouldReplaceInline = (content: string): boolean =>
  content === NULL_INLINE_CONTENT;

const renderLinkMarkdown = (
  annotation: LinkAnnotation,
  content: string,
): AppliedAnnotation => ({
  prefix: "[",
  suffix: `](${annotation.attributes.href})`,
  replace: shouldReplaceInline(content),
});

const renderImageMarkdown = (
  annotation: ImageAnnotation,
  content: string,
): AppliedAnnotation => ({
  prefix: "![",
  suffix: `](${annotation.attributes.src})`,
  replace: shouldReplaceInline(content),
});

const renderObsidianReference = ({
  annotation,
  content,
}: {
  annotation: ReferenceAnnotation;
  content: string;
}): AppliedAnnotation => {
  const attributes = annotation.attributes;
  if (attributes.kind === "obsidian-wikilink") {
    const target = `${attributes.path}${attributes.subpath ?? ""}`;
    const alias = attributes.alias ? `|${attributes.alias}` : "";
    return {
      prefix: "[[",
      suffix: `${target}${alias}]]`,
      replace: true,
    };
  }
  if (attributes.kind === "roam-block") {
    return {
      prefix: "",
      suffix: `((${attributes.blockUid}))`,
      replace: shouldReplaceInline(content),
    };
  }
  return {
    prefix: "[[",
    suffix: `${attributes.pageTitle}]]`,
    replace: shouldReplaceInline(content),
  };
};

const renderRoamReference = ({
  annotation,
  content,
}: {
  annotation: ReferenceAnnotation;
  content: string;
}): AppliedAnnotation => {
  const attributes = annotation.attributes;
  if (attributes.kind === "roam-block") {
    return {
      prefix: "",
      suffix: `((${attributes.blockUid}))`,
      replace: shouldReplaceInline(content),
    };
  }
  if (attributes.kind === "obsidian-wikilink") {
    return {
      prefix: "[[",
      suffix: `${attributes.alias ?? attributes.path}]]`,
      replace: true,
    };
  }
  return {
    prefix: "",
    suffix: `[[${attributes.pageTitle}]]`,
    replace: shouldReplaceInline(content),
  };
};

export const renderInlineToObsidianMarkdown = ({
  text,
  annotations,
}: {
  text: string;
  annotations: InlineAnnotation[];
}): string =>
  renderAnnotatedText({
    text,
    annotations,
    renderers: {
      bold: ({ annotation, content }) => {
        const delimiter = annotation.attributes?.delimiter ?? "**";
        const safeDelimiter = delimiter === "__" ? "__" : "**";
        return {
          prefix: safeDelimiter,
          suffix: annotation.attributes?.open ? "" : safeDelimiter,
          replace: shouldReplaceInline(content),
        };
      },
      italics: ({ annotation, content }) => {
        const delimiter = annotation.attributes?.delimiter ?? "_";
        const safeDelimiter = delimiter === "*" ? "*" : "_";
        return {
          prefix: safeDelimiter,
          suffix: annotation.attributes?.open ? "" : safeDelimiter,
          replace: shouldReplaceInline(content),
        };
      },
      strikethrough: ({ annotation, content }) => ({
        prefix: "~~",
        suffix: annotation.attributes?.open ? "" : "~~",
        replace: shouldReplaceInline(content),
      }),
      code: ({ annotation }) => {
        if (annotation.attributes.display === "block") {
          const ticks = "`".repeat(annotation.attributes.ticks ?? 3);
          return {
            prefix: `${ticks}${annotation.attributes.language ?? ""}\n`,
            suffix: `\n${ticks}`,
          };
        }
        return { prefix: "`", suffix: "`" };
      },
      link: ({ annotation, content }) =>
        renderLinkMarkdown(annotation, content),
      image: ({ annotation, content }) =>
        renderImageMarkdown(annotation, content),
      reference: ({ annotation, content }) =>
        renderObsidianReference({ annotation, content }),
    },
  });

export const renderInlineToRoam = ({
  text,
  annotations,
}: {
  text: string;
  annotations: InlineAnnotation[];
}): string =>
  renderAnnotatedText({
    text,
    annotations,
    renderers: {
      bold: ({ content }) => ({
        prefix: "**",
        suffix: "**",
        replace: shouldReplaceInline(content),
      }),
      italics: ({ content }) => ({
        prefix: "__",
        suffix: "__",
        replace: shouldReplaceInline(content),
      }),
      strikethrough: ({ content }) => ({
        prefix: "~~",
        suffix: "~~",
        replace: shouldReplaceInline(content),
      }),
      code: ({ annotation }) => {
        if (annotation.attributes.display === "block") {
          return {
            prefix: `\`\`\`${annotation.attributes.language ?? ""}\n`,
            suffix: "\n```",
          };
        }
        return { prefix: "`", suffix: "`" };
      },
      link: ({ annotation, content }) =>
        renderLinkMarkdown(annotation, content),
      image: ({ annotation, content }) =>
        renderImageMarkdown(annotation, content),
      reference: ({ annotation, content }) =>
        renderRoamReference({ annotation, content }),
    },
  });

export const getInlineAnnotationsForRange = ({
  annotations,
  start,
  end,
}: {
  annotations: BodyAnnotation[];
  start: number;
  end: number;
}): InlineAnnotation[] =>
  annotations
    .filter(
      (annotation): annotation is InlineAnnotation =>
        annotation.type !== "block" &&
        annotation.start >= start &&
        annotation.end <= end,
    )
    .map((annotation) => ({
      ...annotation,
      start: annotation.start - start,
      end: annotation.end - start,
    }));
