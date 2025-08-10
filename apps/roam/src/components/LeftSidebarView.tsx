import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Collapse, Icon } from "@blueprintjs/core";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import extractRef from "roamjs-components/util/extractRef";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import type {
  LeftSidebarConfig,
  LeftSidebarPersonalSectionConfig,
} from "~/utils/getLeftSidebarSettings";

const parseReference = (text: string) => {
  const extracted = extractRef(text);
  if (extracted !== text) {
    if (text.startsWith("((") && text.endsWith("))")) {
      return { type: "block" as const, uid: extracted, display: text };
    } else if (text.startsWith("[[") && text.endsWith("]]")) {
      return { type: "page" as const, title: extracted, display: extracted };
    }
  }
  return { type: "text" as const, display: text };
};

const truncate = (s: string, max: number | undefined): string => {
  if (!max || max <= 0) return s;
  return s.length > max ? `${s.slice(0, max)}...` : s;
};

const openTarget = async (
  e: React.MouseEvent,
  target: { kind: "block"; uid: string } | { kind: "page"; title: string },
) => {
  e.preventDefault();
  e.stopPropagation();

  if (target.kind === "block") {
    if (e.shiftKey) {
      await openBlockInSidebar(target.uid);
      return;
    }
    await window.roamAlphaAPI.ui.mainWindow.openBlock({
      block: { uid: target.uid },
    });
    return;
  }

  const uid = getPageUidByPageTitle(target.title);
  if (!uid) return;
  if (e.shiftKey) {
    await window.roamAlphaAPI.ui.rightSidebar.addWindow({
      window: { type: "outline", "block-uid": uid },
    });
  } else {
    await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid } });
  }
};

const SectionChildren: React.FC<{
  childrenNodes: { uid: string; text: string }[];
  truncateAt?: number;
}> = ({ childrenNodes, truncateAt }) => {
  if (!childrenNodes?.length) return null;
  return (
    <div>
      {childrenNodes.map((child) => {
        const ref = parseReference(child.text);
        const label = truncate(ref.display, truncateAt);
        const onClick = (e: React.MouseEvent) => {
          if (ref.type === "page")
            return void openTarget(e, { kind: "page", title: ref.title });
          if (ref.type === "block")
            return void openTarget(e, { kind: "block", uid: ref.uid });
          return void openTarget(e, { kind: "page", title: ref.display });
        };
        const isTodo = /\{\{\[\[TODO\]\]\}\}/.test(ref.display);
        return (
          <div key={child.uid} style={{ padding: "4px 0 4px 4px" }}>
            <div
              className={`section-child-item ${isTodo ? "todo-item" : "page"}`}
              style={{
                color: "#495057",
                lineHeight: 1.5,
                borderRadius: 3,
                cursor: "pointer",
              }}
              onClick={onClick}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const PersonalSectionItem: React.FC<{
  section: LeftSidebarPersonalSectionConfig;
}> = ({ section }) => {
  if (section.isSimple) {
    const ref = parseReference(section.text);
    const onClick = (e: React.MouseEvent) => {
      if (ref.type === "page")
        return void openTarget(e, { kind: "page", title: ref.title });
      if (ref.type === "block")
        return void openTarget(e, { kind: "block", uid: ref.uid });
      return void openTarget(e, { kind: "page", title: ref.display });
    };
    return (
      <div style={{ padding: "4px 0 4px 4px" }}>
        <div
          className="page"
          style={{
            color: "#495057",
            lineHeight: 1.5,
            borderRadius: 3,
            cursor: "pointer",
            fontWeight: 500,
          }}
          onClick={onClick}
        >
          {ref.display}
        </div>
        <hr
          style={{
            marginBottom: 4,
            marginTop: 2,
            border: "1px solid #CED9E0",
            borderRadius: 5,
          }}
        />
      </div>
    );
  }

  const truncateAt = section.settings?.truncateResult.value;
  const collapsable = !!section.settings?.collapsable.value;
  const defaultOpen = !!section.settings?.open.value;
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

  const titleRef = parseReference(section.text);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<number | null>(null);

  const handleTitleClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      if (titleRef.type === "page")
        return void openTarget(e, { kind: "page", title: titleRef.title });
      if (titleRef.type === "block")
        return void openTarget(e, { kind: "block", uid: titleRef.uid });
      return void openTarget(e, { kind: "page", title: titleRef.display });
    }

    clickCountRef.current += 1;
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);

    clickTimerRef.current = window.setTimeout(() => {
      if (clickCountRef.current === 1) {
        if (collapsable) setIsOpen((prev) => !prev);
      } else {
        if (titleRef.type === "page")
          void window.roamAlphaAPI.ui.mainWindow.openPage({
            page: { uid: getPageUidByPageTitle(titleRef.title) },
          });
        else if (titleRef.type === "block")
          void window.roamAlphaAPI.ui.mainWindow.openBlock({
            block: { uid: titleRef.uid },
          });
      }
      clickCountRef.current = 0;
      clickTimerRef.current = null;
    }, 250);
  };

  return (
    <div className="collapsable-section">
      <div
        className="sidebar-title-button"
        onClick={handleTitleClick}
        style={{
          display: "flex",
          alignItems: "center",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
          padding: "4px 0",
          width: "100%",
          outline: "none",
          transition: "color 0.2s ease-in",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <span>{titleRef.display}</span>
          {collapsable && (section.children?.length || 0) > 0 && (
            <span>
              <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
            </span>
          )}
        </div>
      </div>
      <hr
        style={{
          marginBottom: 4,
          marginTop: 2,
          border: "1px solid #CED9E0",
          borderRadius: 5,
        }}
      />
      {collapsable ? (
        <Collapse isOpen={isOpen}>
          <SectionChildren
            childrenNodes={section.children || []}
            truncateAt={truncateAt}
          />
        </Collapse>
      ) : (
        <SectionChildren
          childrenNodes={section.children || []}
          truncateAt={truncateAt}
        />
      )}
    </div>
  );
};

const PersonalSections: React.FC<{ config: LeftSidebarConfig["personal"] }> = ({
  config,
}) => {
  const sections = config.sections || [];
  if (!sections.length) return null;
  return (
    <div className="left-sidebar-sections">
      {sections.map((s) => (
        <PersonalSectionItem key={s.uid} section={s} />
      ))}
    </div>
  );
};

const GlobalSection: React.FC<{ config: LeftSidebarConfig["global"] }> = ({
  config,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(!!config.open.value);
  if (!config.children?.length) return null;

  return (
    <div className="collapsable-section">
      <div
        className="sidebar-title-button"
        onClick={() => setIsOpen((p) => !p)}
        style={{
          display: "flex",
          alignItems: "center",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
          padding: "4px 0",
          width: "100%",
          outline: "none",
          transition: "color 0.2s ease-in",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <span>Global</span>
          <span>
            <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
          </span>
        </div>
      </div>
      <hr
        style={{
          marginBottom: 4,
          marginTop: 2,
          border: "1px solid #CED9E0",
          borderRadius: 5,
        }}
      />
      <Collapse isOpen={isOpen}>
        <SectionChildren childrenNodes={config.children} />
      </Collapse>
    </div>
  );
};

const LeftSidebarView: React.FC = () => {
  const [config, setConfig] = useState<LeftSidebarConfig | null>(null);

  useEffect(() => {
    let tries = 0;
    const maxTries = 10;
    const update = () => {
      const cfg = getFormattedConfigTree().leftSidebar;
      const globalCount = cfg.global.children?.length || 0;
      const personalCount = cfg.personal.sections?.length || 0;
      setConfig(cfg);
      return globalCount > 0 || personalCount > 0;
    };

    if (update()) return;
    const timer = window.setInterval(() => {
      tries += 1;
      if (update() || tries >= maxTries) {
        window.clearInterval(timer);
      }
    }, 400);

    return () => window.clearInterval(timer);
  }, []);

  if (!config) return null;

  return (
    <>
      <style>{`
        .personal-shortcut-item:hover{
          color: #F5F8FA !important;
          background-color: #10161A;
        }
        .page:hover{
          color: #F5F8FA;
          background-color: #10161A;
        }
        .todo-item:hover{
          color: #F5F8FA !important;
          background-color: #10161A;
        }
      `}</style>
      <GlobalSection config={config.global} />
      <PersonalSections config={config.personal} />
    </>
  );
};

export const mountLeftSidebarInto = (wrapper: HTMLElement): void => {
  if (!wrapper) return;

  const existingStarred = wrapper.querySelector(
    ".starred-pages",
  ) as HTMLDivElement | null;
  if (existingStarred && !existingStarred.id.includes("dg-left-sidebar-root")) {
    try {
      existingStarred.remove();
    } catch (e) {
      console.warn(
        "[DG][LeftSidebar] failed to remove default starred-pages",
        e,
      );
    }
  }

  // Ensure we only mount once per wrapper
  const id = "dg-left-sidebar-root";
  let root = wrapper.querySelector(`#${id}`) as HTMLDivElement | null;
  if (!root) {
    root = document.createElement("div");
    root.id = id;
    // match Roam starred list container
    root.className = "starred-pages";
    root.style.overflow = "scroll";
    root.style.padding = "15px";
    // Stop Roam's drag-to-reorder interactions from interfering
    root.onmousedown = (e) => e.stopPropagation();
    wrapper.appendChild(root);
  } else {
    // make sure classes/styles are applied on reuse
    root.className = "starred-pages";
    root.style.overflow = "scroll";
    root.style.padding = "15px";
  }

  try {
    ReactDOM.render(<LeftSidebarView />, root);
  } catch (e) {
    console.error("[DG][LeftSidebar] render error", e);
  }
};

export default LeftSidebarView;
