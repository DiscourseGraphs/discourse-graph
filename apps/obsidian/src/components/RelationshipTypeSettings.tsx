import { useState, useRef, useEffect } from "react";
import { DiscourseRelationType } from "~/types";
import { Notice } from "obsidian";
import { usePlugin } from "./PluginContext";
import generateUid from "~/utils/generateUid";
import { ConfirmationModal } from "./ConfirmationModal";
import {
  TLDRAW_COLOR_NAMES,
  TLDRAW_COLOR_LABELS,
  DEFAULT_TLDRAW_COLOR,
  COLOR_PALETTE,
  type TldrawColorName,
} from "~/utils/tldrawColors";
import { getContrastColor } from "~/utils/colorUtils";
import {
  getImportInfo,
  formatImportSource,
  isProvisionalSchema,
  getUserNameById,
} from "~/utils/typeUtils";

type ColorPickerProps = {
  value: string;
  onChange: (color: TldrawColorName) => void;
  disabled?: boolean;
};

const ColorPicker = ({ value, onChange, disabled }: ColorPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  const currentColor = value as TldrawColorName;
  const bgColor = COLOR_PALETTE[currentColor] ?? COLOR_PALETTE.black;
  const textColor = getContrastColor(bgColor ?? DEFAULT_TLDRAW_COLOR);

  return (
    <div ref={dropdownRef} className="relative min-w-32">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded border px-3 py-2 text-left"
        style={{ backgroundColor: bgColor, color: textColor }}
        disabled={disabled}
      >
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full border-2 border-solid"
            style={{ backgroundColor: bgColor, border: `${textColor}` }}
          />
          {TLDRAW_COLOR_LABELS[currentColor]}
        </span>
        <span className="text-sm">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto">
          {TLDRAW_COLOR_NAMES.map((colorName) => {
            const bgColor = COLOR_PALETTE[colorName] ?? COLOR_PALETTE.black;
            return (
              <button
                key={colorName}
                type="button"
                onClick={() => {
                  onChange(colorName);
                  setIsOpen(false);
                }}
                className="flex w-full flex-row justify-start gap-2 rounded-none px-3 py-2"
              >
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: bgColor }}
                />
                {TLDRAW_COLOR_LABELS[colorName]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const RelationshipTypeSettings = () => {
  const plugin = usePlugin();
  const [relationTypes, setRelationTypes] = useState<DiscourseRelationType[]>(
    () => plugin.settings.relationTypes ?? [],
  );
  const [errors, setErrors] = useState<Record<number, string>>({});
  // Ref to always have the latest state for onBlur handlers
  // Updated in handleRelationTypeChange, not on render, to avoid stale reads
  const relationTypesRef = useRef(relationTypes);

  type EditableFieldKey = keyof Omit<
    DiscourseRelationType,
    "id" | "modified" | "created" | "importedFromRid" | "status"
  >;

  const saveSettings = (updatedRelationTypes: DiscourseRelationType[]) => {
    const newErrors: Record<number, string> = {};

    // Validate only complete types (ones with all required fields)
    const completeTypes = updatedRelationTypes.filter(
      (rt) => rt.id && rt.label && rt.complement,
    );

    // Check for duplicate labels
    const seenLabels = new Map<string, number>();
    for (const rt of completeTypes) {
      const idx = updatedRelationTypes.indexOf(rt);
      const prev = seenLabels.get(rt.label);
      if (prev !== undefined) {
        newErrors[idx] = `Duplicate label "${rt.label}"`;
        if (!newErrors[prev]) newErrors[prev] = `Duplicate label "${rt.label}"`;
      }
      seenLabels.set(rt.label, idx);
    }

    // Check for duplicate complements
    const seenComplements = new Map<string, number>();
    for (const rt of completeTypes) {
      const idx = updatedRelationTypes.indexOf(rt);
      const prev = seenComplements.get(rt.complement);
      if (prev !== undefined) {
        newErrors[idx] = `Duplicate complement "${rt.complement}"`;
        if (!newErrors[prev])
          newErrors[prev] = `Duplicate complement "${rt.complement}"`;
      }
      seenComplements.set(rt.complement, idx);
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    // Only persist complete local types + all imported types
    const importedTypes = updatedRelationTypes.filter(
      (rt) => rt.importedFromRid,
    );
    plugin.settings.relationTypes = [
      ...completeTypes.filter((rt) => !rt.importedFromRid),
      ...importedTypes,
    ];
    void plugin.saveSettings();
  };

  const handleRelationTypeChange = (
    index: number,
    field: EditableFieldKey,
    value: string,
  ): void => {
    const now = new Date().getTime();
    const updatedRelationTypes = [...relationTypes];
    if (!updatedRelationTypes[index]) {
      const newId = generateUid("rel");
      updatedRelationTypes[index] = {
        id: newId,
        label: "",
        complement: "",
        color: DEFAULT_TLDRAW_COLOR,
        created: now,
        modified: now,
      };
    }
    const updated = {
      ...updatedRelationTypes[index],
      modified: now,
      ...(field === "color"
        ? { color: value as TldrawColorName }
        : { [field]: value }),
    };
    updatedRelationTypes[index] = updated;
    setRelationTypes(updatedRelationTypes);
    relationTypesRef.current = updatedRelationTypes;
    if (field === "color") {
      // Color is a discrete input — save immediately
      saveSettings(updatedRelationTypes);
    }
  };

  const handleAddRelationType = (): void => {
    const newId = generateUid("rel");
    const now = new Date().getTime();

    const updatedRelationTypes = [
      ...relationTypes,
      {
        id: newId,
        label: "",
        complement: "",
        color: DEFAULT_TLDRAW_COLOR,
        created: now,
        modified: now,
      },
    ];
    setRelationTypes(updatedRelationTypes);
  };

  const confirmDeleteRelationType = (index: number): void => {
    const relationType = relationTypes[index] || {
      label: "Unnamed",
      complement: "",
      color: DEFAULT_TLDRAW_COLOR,
    };
    const modal = new ConfirmationModal(plugin.app, {
      title: "Delete Relation Type",
      message: `Are you sure you want to delete the relation type "${relationType.label}"?`,
      onConfirm: () => {
        void handleDeleteRelationType(index);
      },
    });
    modal.open();
  };

  const handleDeleteRelationType = async (index: number): Promise<void> => {
    const isUsed = plugin.settings.discourseRelations?.some(
      (rel) => rel.relationshipTypeId === relationTypes[index]?.id,
    );

    if (isUsed) {
      new Notice(
        "Cannot delete this relation type as it is used in one or more relations.",
      );
      return;
    }

    const updatedRelationTypes = relationTypes.filter((_, i) => i !== index);
    setRelationTypes(updatedRelationTypes);
    plugin.settings.relationTypes = updatedRelationTypes;
    await plugin.saveSettings();
    new Notice("Relation type deleted successfully");
  };

  const handleAcceptRelationType = async (index: number): Promise<void> => {
    const updatedRelationTypes = [...relationTypes];
    const relType = updatedRelationTypes[index];
    if (!relType) return;
    updatedRelationTypes[index] = { ...relType, status: "accepted" };
    setRelationTypes(updatedRelationTypes);
    plugin.settings.relationTypes = updatedRelationTypes;
    await plugin.saveSettings();
  };

  const localRelationTypes = relationTypes.filter(
    (relationType) => !relationType.importedFromRid,
  );
  const importedRelationTypes = relationTypes.filter(
    (relationType) => relationType.importedFromRid,
  );

  const renderRelationTypeItem = (
    relationType: DiscourseRelationType,
    index: number,
  ) => {
    const importInfo = getImportInfo(relationType.importedFromRid);
    const isImported = importInfo.isImported;
    const isProvisional = isProvisionalSchema(relationType);
    const spaceName = importInfo.spaceUri
      ? formatImportSource(importInfo.spaceUri, plugin.settings.spaceNames)
      : "imported space";

    const error = errors[index];

    return (
      <div key={index} className="setting-item">
        <div className="flex w-full flex-col gap-1">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Label (e.g., supports)"
              value={relationType.label}
              onChange={(e) =>
                handleRelationTypeChange(index, "label", e.target.value)
              }
              onBlur={() => saveSettings(relationTypesRef.current)}
              className={`flex-2 ${error ? "input-error" : ""}`}
              disabled={isImported}
            />
            <input
              type="text"
              placeholder="Complement (e.g., is supported by)"
              value={relationType.complement}
              onChange={(e) =>
                handleRelationTypeChange(index, "complement", e.target.value)
              }
              onBlur={() => saveSettings(relationTypesRef.current)}
              className={`flex-1 ${error ? "input-error" : ""}`}
              disabled={isImported}
            />
            <ColorPicker
              value={relationType.color}
              onChange={(color) =>
                handleRelationTypeChange(index, "color", color)
              }
              disabled={isImported}
            />
            {isImported ? (
              <div className="flex gap-2">
                {isProvisional && (
                  <button
                    onClick={() => void handleAcceptRelationType(index)}
                    className="p-2"
                    title={`Accept this relation type from ${spaceName} to create relations of this type`}
                  >
                    Accept
                  </button>
                )}
                <button
                  onClick={() => confirmDeleteRelationType(index)}
                  className="mod-warning p-2"
                >
                  Delete
                </button>
              </div>
            ) : (
              <button
                onClick={() => confirmDeleteRelationType(index)}
                className="mod-warning p-2"
              >
                Delete
              </button>
            )}
          </div>
          {error && <div className="text-error text-xs">{error}</div>}
          {isImported && (
            <div className="text-muted flex items-center gap-2 text-xs">
              {isProvisional && (
                <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800">
                  Provisional
                </span>
              )}
              {importInfo.spaceUri && (
                <span>
                  {relationType.authorId &&
                    `by ${getUserNameById(plugin, relationType.authorId)} `}
                  from{" "}
                  {formatImportSource(
                    importInfo.spaceUri,
                    plugin.settings.spaceNames,
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="discourse-relation-types">
      {localRelationTypes.length > 0 && (
        <div>
          <h4 className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
            Local
          </h4>
          {localRelationTypes.map((relationType) => {
            const index = relationTypes.indexOf(relationType);
            return renderRelationTypeItem(relationType, index);
          })}
        </div>
      )}

      {importedRelationTypes.length > 0 && (
        <div className="border-modifier-border mt-6 border-t pt-4">
          <h4 className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
            Imported
          </h4>
          <div className="border-modifier-border rounded border bg-secondary p-2">
            {importedRelationTypes.map((relationType) => {
              const index = relationTypes.indexOf(relationType);
              return renderRelationTypeItem(relationType, index);
            })}
          </div>
        </div>
      )}

      <div className="setting-item mt-4">
        <div className="flex gap-2">
          <button onClick={handleAddRelationType} className="p-2">
            Add Relation Type
          </button>
        </div>
      </div>
    </div>
  );
};

export default RelationshipTypeSettings;
