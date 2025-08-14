import { useCallback, useEffect, useState } from "react";
import { TFile } from "obsidian";
import { createShapeId, Editor } from "tldraw";
import DiscourseGraphPlugin from "~/index";
import { DiscourseNode } from "~/types";
import { QueryEngine } from "~/services/QueryEngine";
import SearchBar from "./SearchBar";
import { addWikilinkBlockrefForFile } from "~/utils/assetStore";

export const ExistingNodeSearch = ({
  plugin,
  canvasFile,
  getEditor,
  visible = true,
}: {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  getEditor: () => Editor | null;
  visible?: boolean;
}) => {
  const [engine] = useState(() => new QueryEngine(plugin.app));
  const [nodeTypeIds, setNodeTypeIds] = useState<string[]>([]);

  useEffect(() => {
    const ids = plugin.settings.nodeTypes.map((n: DiscourseNode) => n.id);
    setNodeTypeIds(ids);
  }, [plugin.settings.nodeTypes]);

  const search = useCallback(
    async (query: string) => {
      return engine.searchDiscourseNodesByTitle(query, nodeTypeIds);
    },
    [engine, nodeTypeIds],
  );

  const getItemText = useCallback((file: TFile) => file.basename, []);

  const renderItem = useCallback((file: TFile, el: HTMLElement) => {
    const wrapper = el.createEl("div", {
      cls: "file-suggestion",
      attr: { style: "display:flex; align-items:center; gap:8px;" },
    });
    wrapper.createEl("div", { text: "📄" });
    wrapper.createEl("div", { text: file.basename });
  }, []);

  const handleSelect = useCallback(
    (file: TFile | null) => {
      const editor = getEditor();
      if (!file || !editor) return;
      void (async () => {
        const pagePoint = editor.getViewportScreenCenter();
        console.log("pagePoint on select", pagePoint);
        const src = await addWikilinkBlockrefForFile(
          plugin.app,
          canvasFile,
          file,
        );
        const id = createShapeId();
        editor.createShape({
          id,
          type: "discourse-node",
          x: pagePoint.x - Math.random() * 100,
          y: pagePoint.y - Math.random() * 100,
          props: { w: 200, h: 100, src },
        });
        editor.markHistoryStoppingPoint("add existing discourse node");
        editor.setSelectedShapes([id]);
      })();
    },
    [canvasFile, getEditor, plugin.app],
  );

  if (!visible) return null;

  return (
    <div className="pointer-events-auto rounded-md p-1">
      <SearchBar<TFile>
        onSelect={handleSelect}
        placeholder="Node search"
        getItemText={getItemText}
        renderItem={renderItem}
        asyncSearch={search}
        className="!bg-[var(--color-panel)] !text-[var(--color-text)]"
      />
    </div>
  );
};


