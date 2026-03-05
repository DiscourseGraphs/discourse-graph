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
import { getImportInfo, formatImportSource } from "~/utils/typeUtils";

type ColorPickerProps = {
  value: string;
  onChange: (color: TldrawColorName) => void;
};

const ColorPicker = ({ value, onChange }: ColorPickerProps) => {
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
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded border px-3 py-2 text-left"
        style={{ backgroundColor: bgColor, color: textColor }}
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  type EditableFieldKey = keyof Omit<
    DiscourseRelationType,
    "id" | "modified" | "created" | "importedFromRid"
  >;

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
    updatedRelationTypes[index].modified = now;
    if (field === "color") {
      updatedRelationTypes[index].color = value as TldrawColorName;
    } else {
      updatedRelationTypes[index][field] = value;
    }
    setRelationTypes(updatedRelationTypes);
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
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
      onConfirm: () => handleDeleteRelationType(index),
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

  const handleSave = async (): Promise<void> => {
    for (const relType of relationTypes) {
      if (!relType.id || !relType.label || !relType.complement) {
        new Notice("All fields are required for relation types.");
        return;
      }
    }

    const labels = relationTypes.map((rt) => rt.label);
    if (new Set(labels).size !== labels.length) {
      new Notice("Relation type labels must be unique.");
      return;
    }

    const complements = relationTypes.map((rt) => rt.complement);
    if (new Set(complements).size !== complements.length) {
      new Notice("Relation type complements must be unique.");
      return;
    }

    plugin.settings.relationTypes = relationTypes;
    await plugin.saveSettings();
    setHasUnsavedChanges(false);
    new Notice("Relation types saved.");
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
              className="flex-2"
            />
            <input
              type="text"
              placeholder="Complement (e.g., is supported by)"
              value={relationType.complement}
              onChange={(e) =>
                handleRelationTypeChange(index, "complement", e.target.value)
              }
              className="flex-1"
            />
            <ColorPicker
              value={relationType.color}
              onChange={(color) =>
                handleRelationTypeChange(index, "color", color)
              }
            />
            <button
              onClick={() => confirmDeleteRelationType(index)}
              className="mod-warning p-2"
            >
              Delete
            </button>
          </div>
          {isImported && (
            <div className="text-muted flex items-center gap-2 text-xs">
              {importInfo.spaceUri && (
                <span>
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
          <button
            onClick={handleSave}
            className={`p-2 ${hasUnsavedChanges ? "mod-cta" : ""}`}
            disabled={!hasUnsavedChanges}
          >
            Save Changes
          </button>
        </div>
      </div>
      {hasUnsavedChanges && (
        <div className="text-muted mt-2">You have unsaved changes</div>
      )}
    </div>
  );
};

export default RelationshipTypeSettings;
