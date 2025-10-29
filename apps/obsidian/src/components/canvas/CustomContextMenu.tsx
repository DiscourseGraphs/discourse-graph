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
    (selectedShape?.type === "text" || selectedShape?.type === "image");

  return (
    <DefaultContextMenu {...props}>
      <DefaultContextMenuContent />
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

