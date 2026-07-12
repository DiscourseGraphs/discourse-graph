import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Dialog, MenuItem } from "@blueprintjs/core";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import type { TLFrameShape, TLShape } from "tldraw";
import { getCanvasPageTitles } from "~/utils/isCanvasPage";
import { getPersistedCanvasStore } from "./useRoamStore";

export type DgCanvasFrameSelection = {
  title: string;
  frameName?: string;
  frameShapeId?: string;
};

type CanvasFrameEmbedDialogProps = {
  onSelect: (selection: DgCanvasFrameSelection) => void;
};

type FrameOption = { id: string; name: string; childCount: number };

// Enumerate frames (with a child-shape count as a disambiguator) from the raw
// persisted store — no editor mounted, no migration. Sync-mode canvases may
// show a slightly stale list, acceptable for a picker; any read failure
// degrades to "whole canvas only".
const getCanvasFrames = (pageUid: string): FrameOption[] => {
  try {
    const records = Object.values(getPersistedCanvasStore(pageUid));

    const childCounts = new Map<string, number>();
    for (const record of records) {
      if (record.typeName !== "shape") continue;
      const { parentId } = record;
      childCounts.set(parentId, (childCounts.get(parentId) ?? 0) + 1);
    }

    return records
      .filter(
        (record): record is TLFrameShape =>
          record.typeName === "shape" && (record as TLShape).type === "frame",
      )
      .map((frame) => ({
        id: frame.id,
        name: (frame.props.name ?? "").trim(),
        childCount: childCounts.get(frame.id) ?? 0,
      }));
  } catch {
    return [];
  }
};

const CanvasFrameEmbedDialog = ({
  isOpen,
  onClose,
  onSelect,
}: RoamOverlayProps<CanvasFrameEmbedDialogProps>) => {
  const [canvasPages, setCanvasPages] = useState<string[] | null>(null);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);

  useEffect(() => {
    void getCanvasPageTitles().then(setCanvasPages);
  }, []);

  const frames = useMemo(
    () =>
      selectedPage ? getCanvasFrames(getPageUidByPageTitle(selectedPage)) : [],
    [selectedPage],
  );

  const handlePickPage = useCallback(
    (title: string) => {
      if (canvasPages?.includes(title)) setSelectedPage(title);
    },
    [canvasPages],
  );

  const handleSelectWholeCanvas = useCallback(() => {
    if (!selectedPage) return;
    onSelect({ title: selectedPage });
    onClose();
  }, [selectedPage, onSelect, onClose]);

  const handleSelectFrame = useCallback(
    (frame: FrameOption) => {
      if (!selectedPage) return;
      onSelect({
        title: selectedPage,
        frameName: frame.name || undefined,
        frameShapeId: frame.id,
      });
      onClose();
    },
    [selectedPage, onSelect, onClose],
  );

  const renderPageStep = () => {
    if (canvasPages === null)
      return (
        <div className="text-sm text-[#5c7080]">Loading canvas pages...</div>
      );
    if (canvasPages.length === 0)
      return (
        <div className="text-sm text-[#5c7080]">No canvas pages found</div>
      );
    return (
      <AutocompleteInput
        setValue={handlePickPage}
        options={canvasPages}
        placeholder="Search canvas pages..."
        autoFocus
        autoSelectFirstOption={false}
        renderItem={({ item }) => (
          <MenuItem
            onMouseDown={(event) => {
              event.preventDefault();
              handlePickPage(item);
            }}
            text={item}
          />
        )}
      />
    );
  };

  const renderFrameStep = () => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span
          className="truncate text-sm font-medium"
          title={selectedPage ?? ""}
        >
          {selectedPage}
        </span>
        <Button
          minimal
          small
          icon="arrow-left"
          onClick={() => setSelectedPage(null)}
        >
          Change
        </Button>
      </div>
      <div className="max-h-64 overflow-auto">
        <MenuItem
          icon="widget"
          text="Whole canvas (no frame)"
          onClick={handleSelectWholeCanvas}
        />
        {frames.length === 0 ? (
          <div className="px-2 py-1 text-sm text-[#5c7080]">
            No frames found on this canvas.
          </div>
        ) : (
          frames.map((frame) => (
            <MenuItem
              key={frame.id}
              icon="widget-header"
              text={frame.name || "Untitled frame"}
              label={`${frame.childCount} ${
                frame.childCount === 1 ? "shape" : "shapes"
              }`}
              onClick={() => handleSelectFrame(frame)}
            />
          ))
        )}
      </div>
    </div>
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        selectedPage
          ? "Embed canvas frame"
          : "Embed canvas frame — pick a canvas"
      }
      className="roamjs-canvas-dialog pb-0"
      style={{ width: "400px" }}
    >
      <div className="p-4">
        {selectedPage ? renderFrameStep() : renderPageStep()}
      </div>
    </Dialog>
  );
};

export const renderCanvasFrameEmbedDialog = (
  props: CanvasFrameEmbedDialogProps,
) =>
  renderOverlay({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Overlay: CanvasFrameEmbedDialog,
    props,
  });
