import { useEffect, useMemo, useState } from "react";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseRelationType,
} from "~/types";

export type SchemaSelectionSource = {
  nodeTypes: Pick<DiscourseNode, "id" | "name" | "template">[];
  relationTypes: Pick<DiscourseRelationType, "id" | "label">[];
  relationTriples: Pick<
    DiscourseRelation,
    "id" | "sourceId" | "destinationId" | "relationshipTypeId"
  >[];
  templateNames: string[];
};

type SelectionToggleResult = {
  ok: boolean;
  reason?: string;
};

export type SchemaSelectionState = {
  selectedNodeTypeIds: Set<string>;
  selectedRelationTypeIds: Set<string>;
  selectedRelationIds: Set<string>;
  selectedTemplateNames: Set<string>;
  requiredNodeTypeIds: Set<string>;
  requiredRelationTypeIds: Set<string>;
  selectAllNodeTypes: () => void;
  deselectOptionalNodeTypes: () => void;
  toggleNodeType: (
    nodeTypeId: string,
    shouldSelect: boolean,
  ) => SelectionToggleResult;
  selectAllRelationTypes: () => void;
  deselectOptionalRelationTypes: () => void;
  toggleRelationType: (
    relationTypeId: string,
    shouldSelect: boolean,
  ) => SelectionToggleResult;
  selectAllRelationTriples: () => void;
  deselectAllRelationTriples: () => void;
  toggleRelationTriple: (relationId: string, shouldSelect: boolean) => void;
  selectAllTemplates: () => void;
  deselectAllTemplates: () => void;
  toggleTemplate: (templateName: string, shouldSelect: boolean) => void;
  asSelectionPayload: () => {
    nodeTypeIds: string[];
    relationTypeIds: string[];
    relationIds: string[];
    templateNames: string[];
  };
};

const updateSet = (
  previousSet: Set<string>,
  id: string,
  shouldSelect: boolean,
): Set<string> => {
  const nextSet = new Set(previousSet);
  if (shouldSelect) {
    nextSet.add(id);
  } else {
    nextSet.delete(id);
  }
  return nextSet;
};

export const getReferencedTemplateNames = (
  nodeTypes: SchemaSelectionSource["nodeTypes"],
): Set<string> => {
  return new Set(
    nodeTypes
      .map((nodeType) => nodeType.template)
      .filter((template): template is string => !!template),
  );
};

export const useSchemaSelection = ({
  source,
  initialTemplateNames,
  resetKey,
}: {
  source: SchemaSelectionSource;
  /**
   * Template names to pre-select on mount and on reset. Defaults to all
   * templates in source when not provided.
   */
  initialTemplateNames?: string[];
  resetKey: string;
}): SchemaSelectionState => {
  const [selectedNodeTypeIds, setSelectedNodeTypeIds] = useState<Set<string>>(
    () => new Set(source.nodeTypes.map((nodeType) => nodeType.id)),
  );
  const [selectedRelationTypeIds, setSelectedRelationTypeIds] = useState<
    Set<string>
  >(() => new Set(source.relationTypes.map((relationType) => relationType.id)));
  const [selectedRelationIds, setSelectedRelationIds] = useState<Set<string>>(
    () => new Set(source.relationTriples.map((relation) => relation.id)),
  );
  const [selectedTemplateNames, setSelectedTemplateNames] = useState<
    Set<string>
  >(() => new Set(initialTemplateNames ?? source.templateNames));

  // resetKey is the only trigger; source and initialTemplateNames are read
  // from the current render's closure when resetKey changes.
  useEffect(() => {
    setSelectedNodeTypeIds(
      new Set(source.nodeTypes.map((nodeType) => nodeType.id)),
    );
    setSelectedRelationTypeIds(
      new Set(source.relationTypes.map((relationType) => relationType.id)),
    );
    setSelectedRelationIds(
      new Set(source.relationTriples.map((relation) => relation.id)),
    );
    setSelectedTemplateNames(
      new Set(initialTemplateNames ?? source.templateNames),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const requiredRelationTypeIds = useMemo(() => {
    const requiredIds = new Set<string>();
    for (const relation of source.relationTriples) {
      if (selectedRelationIds.has(relation.id)) {
        requiredIds.add(relation.relationshipTypeId);
      }
    }
    return requiredIds;
  }, [source.relationTriples, selectedRelationIds]);

  const requiredNodeTypeIds = useMemo(() => {
    const requiredIds = new Set<string>();
    for (const relation of source.relationTriples) {
      if (!selectedRelationIds.has(relation.id)) {
        continue;
      }
      requiredIds.add(relation.sourceId);
      requiredIds.add(relation.destinationId);
    }
    return requiredIds;
  }, [source.relationTriples, selectedRelationIds]);

  useEffect(() => {
    setSelectedRelationTypeIds((previousSet) => {
      const nextSet = new Set(previousSet);
      let didChange = false;
      for (const relationTypeId of requiredRelationTypeIds) {
        if (!nextSet.has(relationTypeId)) {
          nextSet.add(relationTypeId);
          didChange = true;
        }
      }
      return didChange ? nextSet : previousSet;
    });
  }, [requiredRelationTypeIds]);

  useEffect(() => {
    setSelectedNodeTypeIds((previousSet) => {
      const nextSet = new Set(previousSet);
      let didChange = false;
      for (const nodeTypeId of requiredNodeTypeIds) {
        if (!nextSet.has(nodeTypeId)) {
          nextSet.add(nodeTypeId);
          didChange = true;
        }
      }
      return didChange ? nextSet : previousSet;
    });
  }, [requiredNodeTypeIds]);

  return {
    selectedNodeTypeIds,
    selectedRelationTypeIds,
    selectedRelationIds,
    selectedTemplateNames,
    requiredNodeTypeIds,
    requiredRelationTypeIds,
    selectAllNodeTypes: () =>
      setSelectedNodeTypeIds(
        new Set(source.nodeTypes.map((nodeType) => nodeType.id)),
      ),
    deselectOptionalNodeTypes: () =>
      setSelectedNodeTypeIds(new Set([...requiredNodeTypeIds])),
    toggleNodeType: (nodeTypeId, shouldSelect) => {
      if (!shouldSelect && requiredNodeTypeIds.has(nodeTypeId)) {
        return {
          ok: false,
          reason:
            "This node type is required by a selected relation triple. Remove the triple first.",
        };
      }
      setSelectedNodeTypeIds((previousSet) =>
        updateSet(previousSet, nodeTypeId, shouldSelect),
      );
      return { ok: true };
    },
    selectAllRelationTypes: () =>
      setSelectedRelationTypeIds(
        new Set(source.relationTypes.map((relationType) => relationType.id)),
      ),
    deselectOptionalRelationTypes: () =>
      setSelectedRelationTypeIds(new Set([...requiredRelationTypeIds])),
    toggleRelationType: (relationTypeId, shouldSelect) => {
      if (!shouldSelect && requiredRelationTypeIds.has(relationTypeId)) {
        return {
          ok: false,
          reason:
            "This relation type is required by a selected relation triple. Remove the triple first.",
        };
      }
      setSelectedRelationTypeIds((previousSet) =>
        updateSet(previousSet, relationTypeId, shouldSelect),
      );
      return { ok: true };
    },
    selectAllRelationTriples: () =>
      setSelectedRelationIds(
        new Set(source.relationTriples.map((relation) => relation.id)),
      ),
    deselectAllRelationTriples: () => setSelectedRelationIds(new Set()),
    toggleRelationTriple: (relationId, shouldSelect) =>
      setSelectedRelationIds((previousSet) =>
        updateSet(previousSet, relationId, shouldSelect),
      ),
    selectAllTemplates: () =>
      setSelectedTemplateNames(new Set(source.templateNames)),
    deselectAllTemplates: () => setSelectedTemplateNames(new Set()),
    toggleTemplate: (templateName, shouldSelect) =>
      setSelectedTemplateNames((previousSet) =>
        updateSet(previousSet, templateName, shouldSelect),
      ),
    asSelectionPayload: () => ({
      nodeTypeIds: [...selectedNodeTypeIds],
      relationTypeIds: [...selectedRelationTypeIds],
      relationIds: [...selectedRelationIds],
      templateNames: [...selectedTemplateNames],
    }),
  };
};
