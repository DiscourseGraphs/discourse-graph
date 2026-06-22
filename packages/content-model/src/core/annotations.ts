import type { Annotation } from "../schema";

export const annotationLength = (annotation: Annotation): number =>
  annotation.end - annotation.start;

export const sortAnnotationsForRendering = <T extends Annotation>(
  annotations: T[],
): T[] =>
  annotations
    .map((annotation, index) => ({ annotation, index }))
    .sort((a, b) => {
      const sizeDelta =
        annotationLength(b.annotation) - annotationLength(a.annotation);
      return sizeDelta || a.index - b.index;
    })
    .map(({ annotation }) => ({ ...annotation }));

export const offsetAnnotations = <T extends Annotation>(
  annotations: T[],
  offset: number,
): T[] =>
  annotations.map((annotation) => ({
    ...annotation,
    start: annotation.start + offset,
    end: annotation.end + offset,
  }));
