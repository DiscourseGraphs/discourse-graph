import type {
  AddReferencedNodeType,
  ReferenceFormatType,
} from "~/components/canvas/DiscourseRelationShape/DiscourseRelationTool";

export type ReferencedNodeActionOption = {
  id: string;
  label: string;
  references: ReferenceFormatType[];
};

export const getValidReferencedNodeActionOptions = ({
  allAddReferencedNodeByAction,
  sourceNodeType,
  targetNodeType,
}: {
  allAddReferencedNodeByAction: AddReferencedNodeType;
  sourceNodeType: string;
  targetNodeType: string;
}): ReferencedNodeActionOption[] =>
  Object.entries(allAddReferencedNodeByAction).reduce<
    ReferencedNodeActionOption[]
  >((options, [id, references]) => {
    const matchingReferences = references.filter(
      (reference) =>
        reference.sourceType === sourceNodeType &&
        reference.destinationType === targetNodeType,
    );

    if (!matchingReferences.length) return options;

    options.push({
      id,
      label: id,
      references: matchingReferences,
    });

    return options;
  }, []);
