import React, { useState, useMemo, useCallback } from "react";
import { Dialog, InputGroup, Menu, MenuItem } from "@blueprintjs/core";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import { DEFAULT_CANVAS_PAGE_FORMAT } from "~/index";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";

type CanvasEmbedDialogProps = {
  onSelect: (title: string) => void;
};

const getCanvasPages = (): { title: string; uid: string }[] => {
  const { canvasPageFormat } = getFormattedConfigTree();
  const format = canvasPageFormat.value || DEFAULT_CANVAS_PAGE_FORMAT;
  const regexSource = `^${format.replace(/\*/g, ".+")}$`;
  const escaped = regexSource.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  try {
    const results = window.roamAlphaAPI.q(`[
      :find (pull ?node [:node/title :block/uid])
      :where
        [(re-pattern "${escaped}") ?regex]
        [?node :node/title ?title]
        [(re-find ?regex ?title)]
    ]`) as [{ title: string; uid: string }][];

    return results
      .map(([r]) => ({ title: r.title, uid: r.uid }))
      .sort((a, b) => a.title.localeCompare(b.title));
  } catch {
    return [];
  }
};

const CanvasEmbedDialog = ({
  isOpen,
  onClose,
  onSelect,
}: RoamOverlayProps<CanvasEmbedDialogProps>) => {
  const [filter, setFilter] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const canvasPages = useMemo(getCanvasPages, []);

  const filtered = useMemo(() => {
    if (!filter) return canvasPages;
    const lower = filter.toLowerCase();
    return canvasPages.filter((p) => p.title.toLowerCase().includes(lower));
  }, [filter, canvasPages]);

  const handleSelect = useCallback(
    (title: string) => {
      onSelect(title);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        handleSelect(filtered[activeIndex].title);
      }
    },
    [filtered, activeIndex, handleSelect],
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Embed Canvas"
      style={{ width: 400, paddingBottom: 0 }}
    >
      <div style={{ padding: "16px" }}>
        <InputGroup
          placeholder="Search canvas pages..."
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setActiveIndex(0);
          }}
          autoFocus
          onKeyDown={handleKeyDown}
        />
        <Menu
          style={{
            maxHeight: "300px",
            overflowY: "auto",
            marginTop: "8px",
          }}
        >
          {filtered.length === 0 ? (
            <MenuItem disabled text="No canvas pages found" />
          ) : (
            filtered.map((page, i) => (
              <MenuItem
                key={page.uid}
                text={page.title}
                active={i === activeIndex}
                onClick={() => handleSelect(page.title)}
              />
            ))
          )}
        </Menu>
      </div>
    </Dialog>
  );
};

export const renderCanvasEmbedDialog = (props: CanvasEmbedDialogProps) =>
  renderOverlay({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Overlay: CanvasEmbedDialog,
    props,
  });
