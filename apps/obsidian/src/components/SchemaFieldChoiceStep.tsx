import type {
  SchemaConflict,
  SchemaFieldChange,
} from "~/utils/schemaFieldDiff";
import type { SchemaMergePlanState } from "~/components/useSchemaMergePlan";
import { getImportedTemplateFileName } from "~/utils/templates";
import { COLOR_PALETTE } from "~/utils/tldrawColors";

const FIELD_LABELS: Record<string, string> = {
  format: "Format",
  template: "Template",
  description: "Description",
  shortcut: "Shortcut",
  color: "Color",
  tag: "Tag",
  keyImage: "Key image",
  folderPath: "Folder path",
  complement: "Complement",
  content: "File contents",
};

const CATEGORY_HEADINGS: Record<SchemaConflict["category"], string> = {
  nodeType: "Node types",
  relationType: "Relation types",
  template: "Templates",
};

const CATEGORY_ORDER: SchemaConflict["category"][] = [
  "nodeType",
  "relationType",
  "template",
];

const formatFieldValue = (value: SchemaFieldChange["localValue"]): string => {
  if (value === undefined || value === "") return "empty";
  if (typeof value === "boolean") return value ? "on" : "off";
  // Collapse newlines so a multi-line value cannot stretch the row; the cell wraps rather than truncating.
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length === 0 ? "empty" : collapsed;
};

const isEmptyValue = (value: SchemaFieldChange["localValue"]): boolean => {
  return (
    value === undefined || (typeof value === "string" && value.trim() === "")
  );
};

/** Node types store a hex color, relation types a tldraw color name; both resolve to a swatch. */
const resolveSwatchColor = ({
  field,
  value,
}: {
  field: string;
  value: SchemaFieldChange["localValue"];
}): string | undefined => {
  if (field !== "color" || typeof value !== "string") return undefined;
  return COLOR_PALETTE[value] ?? (value.startsWith("#") ? value : undefined);
};

const describeTemplateBody = (
  value: SchemaFieldChange["localValue"],
): string => {
  if (typeof value !== "string") return formatFieldValue(value);
  const lineCount = value.split("\n").length;
  return `${value.length} bytes, ${lineCount} line${lineCount === 1 ? "" : "s"}`;
};

const ChoiceCell = ({
  conflict,
  change,
  isImportedSide,
  mergePlan,
}: {
  conflict: SchemaConflict;
  change: SchemaFieldChange;
  isImportedSide: boolean;
  mergePlan: SchemaMergePlanState;
}) => {
  const takesImported = mergePlan.isFieldSelected({
    category: conflict.category,
    schemaId: conflict.schemaId,
    field: change.field,
  });
  const isChosen = isImportedSide ? takesImported : !takesImported;
  const value = isImportedSide ? change.importedValue : change.localValue;
  const swatch = resolveSwatchColor({ field: change.field, value });

  const isTemplateBody =
    conflict.category === "template" && change.field === "content";
  const text = isTemplateBody
    ? describeTemplateBody(value)
    : formatFieldValue(value);

  return (
    <td
      className={`border-t p-0 align-top ${isChosen ? "bg-secondary" : ""}`}
      aria-selected={isChosen}
    >
      <label className="flex cursor-pointer items-start gap-2 px-2 py-2">
        <input
          className="mt-1 shrink-0"
          type="radio"
          name={`${conflict.category}:${conflict.schemaId}:${change.field}`}
          checked={isChosen}
          onChange={() =>
            mergePlan.toggleField({
              category: conflict.category,
              schemaId: conflict.schemaId,
              field: change.field,
              shouldSelect: isImportedSide,
            })
          }
        />
        {swatch && (
          <span
            className="mt-1 inline-block h-3 w-3 shrink-0 rounded border"
            style={{ backgroundColor: swatch }}
          />
        )}
        <span
          className={`min-w-0 break-words ${isChosen ? "font-medium" : "text-muted"} ${
            isEmptyValue(value) ? "italic" : ""
          }`}
          title={typeof value === "string" ? value : undefined}
        >
          {text}
        </span>
        {isImportedSide && isTemplateBody && (
          <span className="text-muted shrink-0" title="added as a new file">
            ⧉
          </span>
        )}
      </label>
    </td>
  );
};

const ItemChoiceTable = ({
  conflict,
  mergePlan,
  sourceVaultName,
}: {
  conflict: SchemaConflict;
  mergePlan: SchemaMergePlanState;
  sourceVaultName: string;
}) => {
  const selectedCount = mergePlan.countSelectedFields(conflict);
  const isAllLocal = selectedCount === 0;
  const isAllImported = selectedCount === conflict.changes.length;

  return (
    <section className="mb-3 rounded border p-3">
      <h5 className="mb-2 break-words text-base font-semibold">
        {conflict.label}
      </h5>
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-1/4" />
          <col className="w-[37.5%]" />
          <col className="w-[37.5%]" />
        </colgroup>
        <thead>
          <tr>
            <th className="text-muted border-b px-2 pb-1 text-left align-bottom text-xs font-normal uppercase tracking-wide">
              Field
            </th>
            <th className="border-b p-0 text-left align-bottom font-normal">
              <button
                type="button"
                aria-pressed={isAllLocal}
                className={`w-full break-words rounded-none px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide ${
                  isAllLocal
                    ? "!bg-accent !text-on-accent"
                    : "text-muted !bg-transparent"
                }`}
                onClick={() =>
                  mergePlan.setAllFields({ conflict, shouldSelect: false })
                }
              >
                Keep all mine
              </button>
            </th>
            <th className="border-b p-0 text-left align-bottom font-normal">
              <button
                type="button"
                aria-pressed={isAllImported}
                title={sourceVaultName}
                className={`w-full break-words rounded-none px-2 py-1 text-left text-xs font-semibold ${
                  isAllImported
                    ? "!bg-accent !text-on-accent"
                    : "text-muted !bg-transparent"
                }`}
                onClick={() =>
                  mergePlan.setAllFields({ conflict, shouldSelect: true })
                }
              >
                <span className="uppercase tracking-wide">Use all from</span>{" "}
                {sourceVaultName}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {conflict.changes.map((change) => (
            <tr key={change.field}>
              <td className="text-muted border-t px-2 py-2 align-top">
                {FIELD_LABELS[change.field] ?? change.field}
              </td>
              <ChoiceCell
                conflict={conflict}
                change={change}
                isImportedSide={false}
                mergePlan={mergePlan}
              />
              <ChoiceCell
                conflict={conflict}
                change={change}
                isImportedSide={true}
                mergePlan={mergePlan}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

export const SchemaFieldChoiceStep = ({
  conflicts,
  mergePlan,
  sourceVaultName,
}: {
  conflicts: SchemaConflict[];
  mergePlan: SchemaMergePlanState;
  sourceVaultName: string;
}) => {
  const totalFields = conflicts.reduce(
    (total, conflict) => total + conflict.changes.length,
    0,
  );
  const selectedFields = conflicts.reduce(
    (total, conflict) => total + mergePlan.countSelectedFields(conflict),
    0,
  );
  const templateConflicts = conflicts.filter(
    (conflict) => conflict.category === "template",
  );

  return (
    <>
      <div className="mb-4 rounded border p-3 text-sm">
        <div className="font-medium">
          {conflicts.length} item(s) already in this vault
        </div>
        <p className="text-muted mt-1">
          Every field starts on your value. Names are never changed by an
          import, because renaming a type does not retag the pages already using
          it.
        </p>
      </div>

      <div className="max-h-96 overflow-y-auto pr-1">
        {CATEGORY_ORDER.map((category) => {
          const categoryConflicts = conflicts.filter(
            (conflict) => conflict.category === category,
          );
          if (categoryConflicts.length === 0) return null;

          return (
            <section key={category} className="mb-5 last:mb-0">
              <h4 className="text-muted mb-2 border-b pb-1 text-xs font-semibold uppercase tracking-wide">
                {CATEGORY_HEADINGS[category]} ({categoryConflicts.length})
              </h4>
              {categoryConflicts.map((conflict) => (
                <ItemChoiceTable
                  key={`${conflict.category}:${conflict.schemaId}`}
                  conflict={conflict}
                  mergePlan={mergePlan}
                  sourceVaultName={sourceVaultName}
                />
              ))}
            </section>
          );
        })}
      </div>

      {templateConflicts.length > 0 && (
        <p className="text-muted mt-2 text-xs">
          ⧉ Your template file is never overwritten — the imported version is
          added beside it as{" "}
          {templateConflicts
            .map((conflict) =>
              getImportedTemplateFileName({
                templateName: conflict.schemaId,
                sourceName: sourceVaultName,
              }),
            )
            .map((name) => `${name}.md`)
            .join(", ")}
          , and node types using it are repointed at the copy.
        </p>
      )}

      <p className="mt-3 border-t pt-3 text-sm font-medium">
        {selectedFields} of {totalFields} field(s) will come from the file
      </p>
    </>
  );
};
