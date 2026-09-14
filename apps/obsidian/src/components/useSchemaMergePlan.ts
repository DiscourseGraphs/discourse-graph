import { useEffect, useState } from "react";
import type {
  SchemaConflict,
  SchemaConflictCategory,
} from "~/utils/schemaFieldDiff";
import type { SchemaMergePlan } from "~/utils/specImport";

/** Kept out of useSchemaSelection: a choice only outlives the selection it belongs to, so it resets separately. */
export type SchemaMergePlanState = {
  isFieldSelected: (args: {
    category: SchemaConflictCategory;
    schemaId: string;
    field: string;
  }) => boolean;
  toggleField: (args: {
    category: SchemaConflictCategory;
    schemaId: string;
    field: string;
    shouldSelect: boolean;
  }) => void;
  setAllFields: (args: {
    conflict: SchemaConflict;
    shouldSelect: boolean;
  }) => void;
  countSelectedFields: (conflict: SchemaConflict) => number;
  asMergePlan: () => SchemaMergePlan;
};

type FieldSelections = ReadonlyMap<string, ReadonlySet<string>>;

/** An empty entry and an absent one mean the same to the apply path, so empties are dropped. */
const withFields = ({
  selections,
  schemaId,
  fields,
}: {
  selections: FieldSelections;
  schemaId: string;
  fields: ReadonlySet<string>;
}): FieldSelections => {
  const nextSelections = new Map(selections);
  if (fields.size === 0) {
    nextSelections.delete(schemaId);
  } else {
    nextSelections.set(schemaId, fields);
  }
  return nextSelections;
};

const withFieldToggled = ({
  selections,
  schemaId,
  field,
  shouldSelect,
}: {
  selections: FieldSelections;
  schemaId: string;
  field: string;
  shouldSelect: boolean;
}): FieldSelections => {
  const nextFields = new Set(selections.get(schemaId) ?? []);
  if (shouldSelect) {
    nextFields.add(field);
  } else {
    nextFields.delete(field);
  }
  return withFields({ selections, schemaId, fields: nextFields });
};

const withNameToggled = ({
  names,
  name,
  shouldSelect,
}: {
  names: ReadonlySet<string>;
  name: string;
  shouldSelect: boolean;
}): ReadonlySet<string> => {
  const nextNames = new Set(names);
  if (shouldSelect) {
    nextNames.add(name);
  } else {
    nextNames.delete(name);
  }
  return nextNames;
};

export const useSchemaMergePlan = ({
  resetKey,
}: {
  resetKey: string;
}): SchemaMergePlanState => {
  const [nodeTypeFields, setNodeTypeFields] = useState<FieldSelections>(
    () => new Map(),
  );
  const [relationTypeFields, setRelationTypeFields] = useState<FieldSelections>(
    () => new Map(),
  );
  const [templateNames, setTemplateNames] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setNodeTypeFields(new Map());
    setRelationTypeFields(new Map());
    setTemplateNames(new Set());
  }, [resetKey]);

  const isFieldSelected: SchemaMergePlanState["isFieldSelected"] = ({
    category,
    schemaId,
    field,
  }) => {
    if (category === "template") return templateNames.has(schemaId);
    const selections =
      category === "nodeType" ? nodeTypeFields : relationTypeFields;
    return selections.get(schemaId)?.has(field) ?? false;
  };

  const toggleField: SchemaMergePlanState["toggleField"] = ({
    category,
    schemaId,
    field,
    shouldSelect,
  }) => {
    if (category === "template") {
      setTemplateNames((previousNames) =>
        withNameToggled({ names: previousNames, name: schemaId, shouldSelect }),
      );
      return;
    }
    const setSelections =
      category === "nodeType" ? setNodeTypeFields : setRelationTypeFields;
    setSelections((previousSelections) =>
      withFieldToggled({
        selections: previousSelections,
        schemaId,
        field,
        shouldSelect,
      }),
    );
  };

  return {
    isFieldSelected,
    toggleField,
    setAllFields: ({ conflict, shouldSelect }) => {
      if (conflict.category === "template") {
        setTemplateNames((previousNames) =>
          withNameToggled({
            names: previousNames,
            name: conflict.schemaId,
            shouldSelect,
          }),
        );
        return;
      }
      const setSelections =
        conflict.category === "nodeType"
          ? setNodeTypeFields
          : setRelationTypeFields;
      setSelections((previousSelections) =>
        withFields({
          selections: previousSelections,
          schemaId: conflict.schemaId,
          fields: shouldSelect
            ? new Set(conflict.changes.map((change) => change.field))
            : new Set(),
        }),
      );
    },
    countSelectedFields: (conflict) =>
      conflict.changes.filter((change) =>
        isFieldSelected({
          category: conflict.category,
          schemaId: conflict.schemaId,
          field: change.field,
        }),
      ).length,
    asMergePlan: () => ({
      nodeTypeFields,
      relationTypeFields,
      templateNames,
    }),
  };
};
