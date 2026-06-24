type SchemaNodeTypeLike = {
  id: string;
  name: string;
  template?: string;
};

type SchemaRelationTypeLike = {
  id: string;
  label: string;
};

type SchemaRelationTripleLike = {
  id: string;
  sourceId: string;
  destinationId: string;
  relationshipTypeId: string;
};

type SchemaSelectionPanelProps = {
  nodeTypes: SchemaNodeTypeLike[];
  relationTypes: SchemaRelationTypeLike[];
  relationTriples: SchemaRelationTripleLike[];
  templateNames: string[];
  selectedNodeTypeIds: Set<string>;
  selectedRelationTypeIds: Set<string>;
  selectedRelationIds: Set<string>;
  selectedTemplateNames: Set<string>;
  requiredNodeTypeIds: Set<string>;
  requiredRelationTypeIds: Set<string>;
  onSelectAllNodeTypes: () => void;
  onDeselectOptionalNodeTypes: () => void;
  onToggleNodeType: (nodeTypeId: string, shouldSelect: boolean) => void;
  onSelectAllRelationTypes: () => void;
  onDeselectOptionalRelationTypes: () => void;
  onToggleRelationType: (relationTypeId: string, shouldSelect: boolean) => void;
  onSelectAllRelationTriples: () => void;
  onDeselectAllRelationTriples: () => void;
  onToggleRelationTriple: (relationId: string, shouldSelect: boolean) => void;
  onSelectAllTemplates: () => void;
  onDeselectAllTemplates: () => void;
  onToggleTemplate: (templateName: string, shouldSelect: boolean) => void;
  emptyTemplateText: string;
};

export const SchemaSelectionPanel = ({
  nodeTypes,
  relationTypes,
  relationTriples,
  templateNames,
  selectedNodeTypeIds,
  selectedRelationTypeIds,
  selectedRelationIds,
  selectedTemplateNames,
  requiredNodeTypeIds,
  requiredRelationTypeIds,
  onSelectAllNodeTypes,
  onDeselectOptionalNodeTypes,
  onToggleNodeType,
  onSelectAllRelationTypes,
  onDeselectOptionalRelationTypes,
  onToggleRelationType,
  onSelectAllRelationTriples,
  onDeselectAllRelationTriples,
  onToggleRelationTriple,
  onSelectAllTemplates,
  onDeselectAllTemplates,
  onToggleTemplate,
  emptyTemplateText,
}: SchemaSelectionPanelProps) => {
  const nodeTypeById = new Map(
    nodeTypes.map((nodeType) => [nodeType.id, nodeType]),
  );
  const relationTypeById = new Map(
    relationTypes.map((relationType) => [relationType.id, relationType]),
  );
  const templateToNodeTypeNames = new Map<string, string[]>();
  for (const nodeType of nodeTypes) {
    if (!nodeType.template) continue;
    const current = templateToNodeTypeNames.get(nodeType.template) ?? [];
    current.push(nodeType.name);
    templateToNodeTypeNames.set(nodeType.template, current);
  }
  for (const [
    templateName,
    nodeTypeNames,
  ] of templateToNodeTypeNames.entries()) {
    templateToNodeTypeNames.set(
      templateName,
      [...new Set(nodeTypeNames)].sort((left, right) =>
        left.localeCompare(right),
      ),
    );
  }
  const referencedTemplateNames = new Set(templateToNodeTypeNames.keys());

  return (
    <>
      <div className="mb-4 rounded border p-3 text-sm">
        <div className="font-medium">Selection summary</div>
        <div className="text-muted mt-1 flex flex-wrap gap-4">
          <span>{selectedNodeTypeIds.size} node type(s)</span>
          <span>{selectedRelationTypeIds.size} relation type(s)</span>
          <span>{selectedRelationIds.size} relation triple(s)</span>
          <span>{selectedTemplateNames.size} template(s)</span>
        </div>
      </div>

      <div className="max-h-96 space-y-4 overflow-y-auto">
        <section className="rounded border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-medium">Node types</h4>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={onSelectAllNodeTypes}
              >
                Select all
              </button>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={onDeselectOptionalNodeTypes}
              >
                Deselect optional
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {nodeTypes.map((nodeType) => {
              const isRequired = requiredNodeTypeIds.has(nodeType.id);
              return (
                <label
                  key={nodeType.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedNodeTypeIds.has(nodeType.id)}
                    onChange={(event) =>
                      onToggleNodeType(nodeType.id, event.target.checked)
                    }
                    disabled={isRequired}
                  />
                  <span>{nodeType.name}</span>
                  {isRequired && (
                    <span className="text-muted text-xs">
                      required by selected triple
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </section>

        <section className="rounded border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-medium">Relation types</h4>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={onSelectAllRelationTypes}
              >
                Select all
              </button>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={onDeselectOptionalRelationTypes}
              >
                Deselect optional
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {relationTypes.map((relationType) => {
              const isRequired = requiredRelationTypeIds.has(relationType.id);
              return (
                <label
                  key={relationType.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedRelationTypeIds.has(relationType.id)}
                    onChange={(event) =>
                      onToggleRelationType(
                        relationType.id,
                        event.target.checked,
                      )
                    }
                    disabled={isRequired}
                  />
                  <span>{relationType.label}</span>
                  {isRequired && (
                    <span className="text-muted text-xs">
                      required by selected triple
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </section>

        <section className="rounded border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-medium">Relation triples</h4>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={onSelectAllRelationTriples}
              >
                Select all
              </button>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={onDeselectAllRelationTriples}
              >
                Deselect all
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {relationTriples.map((relation) => {
              const sourceName =
                nodeTypeById.get(relation.sourceId)?.name ?? relation.sourceId;
              const destinationName =
                nodeTypeById.get(relation.destinationId)?.name ??
                relation.destinationId;
              const relationTypeLabel =
                relationTypeById.get(relation.relationshipTypeId)?.label ??
                relation.relationshipTypeId;

              return (
                <label
                  key={relation.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedRelationIds.has(relation.id)}
                    onChange={(event) =>
                      onToggleRelationTriple(relation.id, event.target.checked)
                    }
                  />
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                    {sourceName}
                  </span>
                  <span className="text-accent text-xs font-medium">
                    {relationTypeLabel}
                  </span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                    {destinationName}
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="rounded border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-medium">Templates</h4>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={onSelectAllTemplates}
              >
                Select all
              </button>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs"
                onClick={onDeselectAllTemplates}
              >
                Deselect all
              </button>
            </div>
          </div>
          {templateNames.length === 0 ? (
            <p className="text-muted text-sm">{emptyTemplateText}</p>
          ) : (
            <div className="space-y-1">
              {templateNames.map((templateName) => (
                <label
                  key={templateName}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedTemplateNames.has(templateName)}
                    onChange={(event) =>
                      onToggleTemplate(templateName, event.target.checked)
                    }
                  />
                  <span>{templateName}.md</span>
                  {referencedTemplateNames.has(templateName) && (
                    <span className="text-muted rounded bg-secondary px-1.5 py-0.5 text-xs">
                      used by{" "}
                      {(templateToNodeTypeNames.get(templateName) ?? []).join(
                        ", ",
                      )}{" "}
                      type
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
};
