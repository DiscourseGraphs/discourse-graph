import {
  DefaultContextMenu,
  TldrawUiMenuGroup,
  TldrawUiMenuSubmenu,
  TldrawUiMenuItem,
  useEditor,
  TLUiContextMenuProps,
  DefaultContextMenuContent,
} from "tldraw";
import type { TFile } from "obsidian";
import { usePlugin } from "~/components/PluginContext";
import { convertToDiscourseNode } from "./utils/convertToDiscourseNode";

type CustomContextMenuProps = {
  canvasFile: TFile;
  props: TLUiContextMenuProps;
};

export const CustomContextMenu = ({ canvasFile, props }: CustomContextMenuProps) => {
  const editor = useEditor();
  const plugin = usePlugin();

  // Get selected shapes
  const selectedShapes = editor.getSelectedShapes();

  // Check if we have exactly one text or image shape selected
  const shouldShowConvertTo =
    selectedShapes.length === 1 &&
    selectedShapes[0] &&
    (selectedShapes[0].type === "text" || selectedShapes[0].type === "image");

  return (
    <DefaultContextMenu {...props}>
      <DefaultContextMenuContent />
      {shouldShowConvertTo && selectedShapes[0] && (
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
                    shape: selectedShapes[0]!,
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
}

