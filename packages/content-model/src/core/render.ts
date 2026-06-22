import type { Annotation } from "../schema";
import { sortAnnotationsForRendering } from "./annotations";

export type AppliedAnnotation = {
  prefix: string;
  suffix: string;
  replaceWith?: string;
};

export type AnnotationRenderer =
  | AppliedAnnotation
  | ((args: {
      annotation: Annotation;
      content: string;
      index: number;
    }) => AppliedAnnotation);

export type AnnotationRenderers = Partial<
  Record<Annotation["type"], AnnotationRenderer>
>;

const resolveRenderer = ({
  annotation,
  renderer,
  content,
  index,
}: {
  annotation: Annotation;
  renderer: AnnotationRenderer | undefined;
  content: string;
  index: number;
}): AppliedAnnotation => {
  if (!renderer) return { prefix: "", suffix: "" };
  return typeof renderer === "function"
    ? renderer({ annotation, content, index })
    : renderer;
};

export const renderAnnotatedText = ({
  text,
  annotations,
  renderers,
}: {
  text: string;
  annotations: Annotation[];
  renderers: AnnotationRenderers;
}): string => {
  const sorted = sortAnnotationsForRendering(annotations);
  return sorted.reduce((output, annotation, index) => {
    const content = output.slice(annotation.start, annotation.end);
    const applied = resolveRenderer({
      annotation,
      renderer: renderers[annotation.type],
      content,
      index,
    });
    const replacement = applied.replaceWith ?? content;
    const rendered = `${applied.prefix}${replacement}${applied.suffix}`;
    const replacementDelta = replacement.length - content.length;
    for (const next of sorted.slice(index + 1)) {
      next.start +=
        (next.start >= annotation.start ? applied.prefix.length : 0) +
        (next.start >= annotation.end
          ? applied.suffix.length + replacementDelta
          : 0);
      next.end +=
        (next.end > annotation.start ? applied.prefix.length : 0) +
        (next.end > annotation.end
          ? applied.suffix.length + replacementDelta
          : 0);
    }
    return `${output.slice(0, annotation.start)}${rendered}${output.slice(
      annotation.end,
    )}`;
  }, text);
};
