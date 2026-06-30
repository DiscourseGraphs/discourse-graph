import {
  DefaultContextMenu,
  TldrawUiMenuGroup,
  TldrawUiMenuSubmenu,
  TldrawUiMenuItem,
  useEditor,
  TLUiContextMenuProps,
  DefaultContextMenuContent,
  useValue,
} from "tldraw";
import type { TFile } from "obsidian";
import { usePlugin } from "~/components/PluginContext";
import { convertToDiscourseNode } from "./utils/convertToDiscourseNode";
import {
  convertArrowToDiscourseRelation,
  getValidRelationTypesForArrow,
} from "./utils/convertArrowToDiscourseRelation";

type CustomContextMenuProps = {
  canvasFile: TFile;
  props: TLUiContextMenuProps;
};

export const CustomContextMenu = ({
  canvasFile,
  props,
}: CustomContextMenuProps) => {
  const editor = useEditor();
  const plugin = usePlugin();

  const selectedShape = useValue(
    "selectedShape",
    () => editor.getOnlySelectedShape(),
    [editor],
  );

  const shouldShowConvertTo =
    selectedShape &&
    (selectedShape.type === "text" || selectedShape.type === "image");

  const isReadonly = useValue(
    "isReadonly",
    () => editor.getInstanceState().isReadonly,
    [editor],
  );

  const validRelationTypes = useValue(
    "validRelationTypes",
    () => {
      if (!selectedShape || selectedShape.type !== "arrow") return [];
      return getValidRelationTypesForArrow({
        editor,
        plugin,
        arrowId: selectedShape.id,
      });
    },
    [editor, plugin, selectedShape?.id, selectedShape?.type],
  );

  const shouldShowRelationMenu =
    selectedShape?.type === "arrow" && validRelationTypes.length > 0;

  return (
    <DefaultContextMenu {...props}>
      <DefaultContextMenuContent />
      {shouldShowRelationMenu && (
        <TldrawUiMenuGroup id="relation">
          <TldrawUiMenuSubmenu id="relation-submenu" label="Relation">
            {validRelationTypes.map((relationType) => (
              <TldrawUiMenuItem
                key={relationType.id}
                id={`relation-${relationType.id}`}
                label={relationType.label}
                disabled={isReadonly}
                onSelect={() => {
                  void convertArrowToDiscourseRelation({
                    editor,
                    plugin,
                    canvasFile,
                    arrowId: selectedShape.id,
                    relationTypeId: relationType.id,
                  });
                }}
              />
            ))}
          </TldrawUiMenuSubmenu>
        </TldrawUiMenuGroup>
      )}
      {shouldShowConvertTo && (
        <TldrawUiMenuGroup id="convert-to">
          <TldrawUiMenuSubmenu id="convert-to-submenu" label="Convert To">
            {plugin.settings.nodeTypes.map((nodeType) => (
              <TldrawUiMenuItem
                key={nodeType.id}
                id={`convert-to-${nodeType.id}`}
                label={"Convert to " + nodeType.name}
                icon="file-type"
                onSelect={() => {
                  void convertToDiscourseNode({
                    editor,
                    shape: selectedShape,
                    nodeType,
                    plugin,
                    canvasFile,
                  });
                }}
              />
            ))}
          </TldrawUiMenuSubmenu>
        </TldrawUiMenuGroup>
      )}
    </DefaultContextMenu>
  );
};
