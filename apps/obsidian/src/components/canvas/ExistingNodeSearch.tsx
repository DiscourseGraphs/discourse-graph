import { useCallback, useState } from "react";
import { TFile } from "obsidian";
import { createShapeId, Editor } from "tldraw";
import DiscourseGraphPlugin from "~/index";
import { QueryEngine } from "~/services/QueryEngine";
import SearchBar from "~/components/SearchBar";
import { addWikilinkBlockrefForFile } from "./stores/assetStore";
import { getFrontmatterForFile } from "./shapes/discourseNodeShapeUtils";
import { DiscourseNode } from "~/types";

export const ExistingNodeSearch = ({
  plugin,
  canvasFile,
  getEditor,
  nodeTypeId,
}: {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  getEditor: () => Editor | null;
  nodeTypeId?: string;
}) => {
  const [engine] = useState(() => new QueryEngine(plugin.app));

  const search = useCallback(
    async (query: string) => {
      return engine.searchDiscourseNodesByTitle(query, nodeTypeId);
    },
    [engine, nodeTypeId],
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
        try {
          const src = await addWikilinkBlockrefForFile({
            app: plugin.app,
            canvasFile,
            linkedFile: file,
          });
          const id = createShapeId();
          editor.createShape({
            id,
            type: "discourse-node",
            x: pagePoint.x - Math.random() * 100,
            y: pagePoint.y - Math.random() * 100,
            props: {
              w: 200,
              h: 100,
              src,
              title: file.basename,
              nodeTypeId: getFrontmatterForFile(plugin.app, file)?.nodeTypeId,
            },
          });
          editor.markHistoryStoppingPoint("add existing discourse node");
          editor.setSelectedShapes([id]);
        } catch (error) {
          console.error("Error in handleSelect:", error);
        }
      })();
    },
    [canvasFile, getEditor, plugin.app],
  );

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
