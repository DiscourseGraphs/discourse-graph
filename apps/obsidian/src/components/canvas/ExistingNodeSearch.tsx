import { useCallback, useState } from "react";
import { TFile } from "obsidian";
import { createShapeId, Editor } from "tldraw";
import DiscourseGraphPlugin from "~/index";
import { QueryEngine } from "~/services/QueryEngine";
import SearchBar from "~/components/SearchBar";
import { addWikilinkBlockrefForFile } from "./stores/assetStore";
import {
  getFirstImageSrcForFile,
  getFrontmatterForFile,
} from "./shapes/discourseNodeShapeUtils";
import { DiscourseNode } from "~/types";
import { calcDiscourseNodeSize } from "~/utils/calcDiscourseNodeSize";

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
      return await engine.searchDiscourseNodesByTitle(query, nodeTypeId);
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
          const fmNodeTypeId = getFrontmatterForFile(plugin.app, file)
            ?.nodeTypeId as string | undefined;
          const nodeType: DiscourseNode | undefined = fmNodeTypeId
            ? plugin.settings.nodeTypes.find((n) => n.id === fmNodeTypeId)
            : undefined;
          let preloadedImageSrc: string | undefined = undefined;
          if (nodeType?.keyImage) {
            try {
              const found = await getFirstImageSrcForFile(plugin.app, file);
              if (found) preloadedImageSrc = found;
            } catch (e) {
              console.warn(
                "ExistingNodeSearch: failed to preload key image",
                e,
              );
            }
          }

          // Calculate optimal dimensions using dynamic measurement
          const { w, h } = await calcDiscourseNodeSize({
            title: file.basename,
            nodeTypeId: fmNodeTypeId ?? "",
            imageSrc: preloadedImageSrc,
            plugin,
          });

          const id = createShapeId();
          editor.createShape({
            id,
            type: "discourse-node",
            x: pagePoint.x - Math.random() * 100,
            y: pagePoint.y - Math.random() * 100,
            props: {
              w,
              h,
              src,
              title: file.basename,
              nodeTypeId: fmNodeTypeId ?? "",
              imageSrc: preloadedImageSrc,
            },
          });
          editor.markHistoryStoppingPoint("add existing discourse node");
          editor.setSelectedShapes([id]);
          editor.setCurrentTool("select");
        } catch (error) {
          console.error("Error in handleSelect:", error);
        }
      })();
    },
    [canvasFile, getEditor, plugin],
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
