import { setIcon, setTooltip } from "obsidian";

type InfoTooltipProps = {
  content: string;
};

export const InfoTooltip = ({ content }: InfoTooltipProps) => (
  <button
    ref={(el) => {
      if (el) setTooltip(el, content);
    }}
    className="clickable-icon text-muted hover:text-normal flex h-4 w-4 items-center justify-center"
  >
    <div ref={(el) => (el && setIcon(el, "info")) || undefined} />
  </button>
);
