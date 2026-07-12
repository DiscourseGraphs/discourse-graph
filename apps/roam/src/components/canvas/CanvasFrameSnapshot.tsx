// Static renderer for frame-anchored `{{dg-canvas}}` embeds: exports the frame
// to an SVG image from the persisted canvas data instead of mounting an
// interactive editor. Recomputes on every mount (Roam re-mounts observer
// components on block re-render), which is the feature's whole refresh model —
// no watchers.
//
// Why not tldraw's <TldrawImage>: in tldraw 2.4.6 it builds its internal store
// without custom binding utils or migrations, so discourse-graph canvases
// (per-relation binding records, legacy node-uid shape types) throw during
// store creation. This component replicates its export flow (temporary
// headless Editor → getSvgString → blob URL → <img>) on top of a
// full-fidelity store built exactly like the live mount's.
//
// The export uses tldraw's single-frame semantics (getSvgString([frameId])):
// descendants are included and clipped to the frame, neighbors excluded, the
// frame's own border/label is not drawn, and the image bounds are the frame's
// page bounds with no padding — rotated and nested frames included, no
// hand-rolled transform math.
import React, { useEffect, useState } from "react";
import { Button, Spinner } from "@blueprintjs/core";
import {
  defaultBindingUtils,
  defaultEditorAssetUrls,
  defaultShapeUtils,
  Editor,
  usePreloadAssets,
} from "tldraw";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "~/utils/getDiscourseRelations";
import { buildAllAddReferencedNodeByAction } from "~/utils/buildAllAddReferencedNodeByAction";
import { getFrameEmbedMode } from "~/utils/dgCanvasEmbed";
import { writeFrameZoomHint } from "~/utils/canvasFrameZoomHint";
import { discourseContext } from "./Tldraw";
import {
  createBindingUtils,
  createShapeUtils,
} from "./useCanvasStoreAdapterArgs";
import { createMigrations } from "./DiscourseRelationShape/discourseRelationMigrations";
import { getRoamCanvasSnapshot } from "./useRoamStore";
import { getEffectiveCanvasSyncMode } from "./canvasSyncMode";
import { buildFrameExportStore } from "./canvasFrameExportStore";
import { resolveFrameShape, type FrameRef } from "./canvasFrameRef";
import { CanvasFrameEmbed } from "./CanvasFrameEmbed";

// The same schema inputs the live canvas derives inside TldrawCanvas, built
// headlessly. Also populates the discourseContext singleton (node colors /
// relation lookups read by the shape utils) in case no canvas has mounted
// yet this session.
const buildFrameExportDeps = () => {
  const allNodes = getDiscourseNodes();
  const allRelations = getDiscourseRelations();

  discourseContext.nodes = Object.fromEntries(
    allNodes.map((n, index) => [n.type, { ...n, index }]),
  );
  discourseContext.relations = allRelations.reduce(
    (acc, r) => {
      if (acc[r.label]) {
        acc[r.label].push(r);
      } else {
        acc[r.label] = [r];
      }
      return acc;
    },
    {} as Record<string, DiscourseRelation[]>,
  );

  const allRelationIds = Array.from(new Set(allRelations.map((r) => r.id)));
  const allAddReferencedNodeByAction =
    buildAllAddReferencedNodeByAction(allNodes);

  return {
    migrations: [
      createMigrations({
        allRelationIds,
        allAddReferencedNodeActions: Object.keys(allAddReferencedNodeByAction),
        allNodeTypes: allNodes.map((n) => n.type),
      }),
    ],
    customShapeUtils: createShapeUtils({
      allNodes,
      allRelationIds,
      allAddReferencedNodeByAction,
    }),
    customBindingUtils: createBindingUtils({
      allRelationIds,
      allAddReferencedNodeByAction,
    }),
  };
};

type SnapshotStatus =
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "frame-missing" }
  | { kind: "empty-canvas" }
  | { kind: "error" };

export const CanvasFrameSnapshot = ({
  title,
  pageUid,
  frame,
  onEditHere,
}: {
  title: string;
  pageUid: string;
  frame: FrameRef;
  onEditHere: () => void;
}): JSX.Element => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<SnapshotStatus>({ kind: "loading" });
  const [hovered, setHovered] = useState(false);
  // Fonts must be loaded before the headless editor measures text, or node
  // titles come out mispositioned (same preload the live canvas performs).
  const assetLoading = usePreloadAssets(defaultEditorAssetUrls);

  useEffect(() => {
    if (!container || !assetLoading.done) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    const exportFrame = async () => {
      const deps = buildFrameExportDeps();
      // Personal records (camera/instance/presence) are irrelevant to an
      // export and excluded so stale session state can't affect it.
      const snapshot = getRoamCanvasSnapshot({
        pageUid,
        ...deps,
        includePersonalRecords: false,
      });
      if (!snapshot) {
        if (!cancelled) setStatus({ kind: "empty-canvas" });
        return;
      }

      const store = buildFrameExportStore({ snapshot, ...deps });
      const shapeUtils = [...defaultShapeUtils, ...deps.customShapeUtils];
      const bindingUtils = [...defaultBindingUtils, ...deps.customBindingUtils];

      // tldraw's text measurement needs a real container with the tl-container
      // theme classes; both are cleaned up as soon as the export resolves.
      const tempElm = document.createElement("div");
      container.appendChild(tempElm);
      container.classList.add("tl-container", "tl-theme__light");
      const editor = new Editor({
        store,
        shapeUtils,
        bindingUtils,
        tools: [],
        getContainer: () => tempElm,
      });
      try {
        const frameShape = resolveFrameShape(editor, frame);
        if (!frameShape) {
          if (!cancelled) setStatus({ kind: "frame-missing" });
          return;
        }
        const framePageId = editor.getAncestorPageId(frameShape);
        if (framePageId && framePageId !== editor.getCurrentPageId()) {
          editor.setCurrentPage(framePageId);
        }
        const result = await editor.getSvgString([frameShape.id], {
          background: true,
          scale: 1,
        });
        if (cancelled) return;
        if (!result) {
          setStatus({ kind: "frame-missing" });
          return;
        }
        objectUrl = URL.createObjectURL(
          new Blob([result.svg], { type: "image/svg+xml" }),
        );
        setStatus({ kind: "ready", url: objectUrl });
      } finally {
        editor.dispose();
        tempElm.remove();
      }
    };

    exportFrame().catch((error) => {
      // eslint-disable-next-line no-console
      console.warn("dg-canvas: frame snapshot export failed", error);
      if (!cancelled) setStatus({ kind: "error" });
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // `frame` is created once per embed render by renderCanvasEmbed, so its
    // identity is stable for the lifetime of this mount.
  }, [container, assetLoading.done, pageUid, frame]);

  const handleOpenCanvas = () => {
    writeFrameZoomHint({ pageUid, frame });
    void window.roamAlphaAPI.ui.mainWindow.openPage({
      page: { uid: pageUid },
    });
  };

  const frameLabel = frame.name ? `“${frame.name}” ` : "";
  const placeholderMessage =
    status.kind === "frame-missing"
      ? `Frame ${frameLabel}not found on [[${title}]]`
      : status.kind === "empty-canvas"
        ? `[[${title}]] has no drawing yet`
        : status.kind === "error"
          ? "Couldn't render a snapshot of this frame — use “Edit here” for the live view"
          : null;

  return (
    <div
      ref={setContainer}
      className="relative h-full w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {status.kind === "ready" && (
        <img
          src={status.url}
          alt={`Canvas frame ${frame.name ?? ""} on ${title}`}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      )}
      {status.kind === "loading" && (
        <div className="flex h-full w-full items-center justify-center">
          <Spinner size={24} />
        </div>
      )}
      {placeholderMessage && (
        <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
          {placeholderMessage}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          zIndex: 300,
          display: "flex",
          gap: 4,
          // Chrome fades in on hover over the embed; always visible on the
          // failure placeholders so the escape hatches are discoverable.
          opacity: hovered || status.kind === "error" ? 1 : 0,
          pointerEvents: hovered || status.kind === "error" ? "auto" : "none",
          transition: "opacity 120ms ease",
        }}
      >
        <Button
          small
          icon="document-open"
          title="Open the canvas page zoomed to this frame"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleOpenCanvas}
        >
          Open canvas
        </Button>
        <Button
          small
          icon="edit"
          title="Edit the canvas right here (until this block re-renders)"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onEditHere}
        >
          Edit here
        </Button>
      </div>
    </div>
  );
};

// Decides how a frame-anchored embed renders: static snapshot by default, the
// live editor when the block opts in with `live`, when the canvas is a
// sync-mode (multiplayer) canvas whose block-props snapshot could be stale,
// or when the user clicks "Edit here" (local state only — reverts to the
// snapshot when the block re-renders).
export const CanvasFrameEmbedRouter = ({
  title,
  pageUid,
  frame,
  live,
}: {
  title: string;
  pageUid: string;
  frame: FrameRef;
  live?: boolean;
}): JSX.Element => {
  const [editHere, setEditHere] = useState(false);
  const mode = getFrameEmbedMode({
    live,
    canvasSyncMode: getEffectiveCanvasSyncMode({ pageUid }),
  });

  if (mode === "live" || editHere) {
    return <CanvasFrameEmbed title={title} frame={frame} />;
  }
  if (mode === "live-sync-fallback") {
    return (
      <CanvasFrameEmbed
        title={title}
        frame={frame}
        notice="Showing the live canvas: this canvas uses real-time sync, so a static snapshot could be out of date."
      />
    );
  }
  return (
    <CanvasFrameSnapshot
      title={title}
      pageUid={pageUid}
      frame={frame}
      onEditHere={() => setEditHere(true)}
    />
  );
};
