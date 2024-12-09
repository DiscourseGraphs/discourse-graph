import getDiscourseRelations from "./getDiscourseRelations";

const getDiscourseRelationLabels = (relations = getDiscourseRelations()) =>
  Array.from(new Set(relations.flatMap((r) => [r.label, r.complement]))).filter(
    (s) => !!s,
  );

export default getDiscourseRelationLabels;
