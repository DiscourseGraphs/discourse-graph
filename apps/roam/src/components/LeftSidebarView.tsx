import React, { useRef, useState } from "react";
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
import { createBlock } from "roamjs-components/writes";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";

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

type SectionChildrenProps = {
  childrenNodes: { uid: string; text: string }[];
  truncateAt?: number;
};
const SectionChildren = ({
  childrenNodes,
  truncateAt,
}: SectionChildrenProps): JSX.Element | null => {
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
        return (
          <div key={child.uid} style={{ padding: "4px 0 4px 4px" }}>
            <div
              className={"section-child-item page"}
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

type PersonalSectionItemProps = {
  section: LeftSidebarPersonalSectionConfig;
};
const PersonalSectionItem = ({
  section,
}: PersonalSectionItemProps): JSX.Element => {
  const ref = extractRef(section.text);
  const blockText = getTextByBlockUid(ref);
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
          {blockText || ref.display}
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
  const alias = section.settings?.alias?.value;
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
        if (collapsable) {
          setIsOpen((prev) => !prev);
          if (section.settings?.open.uid) {
            deleteBlock(section.settings.open.uid);
            section.settings.open.uid = undefined;
            section.settings.open.value = false;
          } else {
            if (section.settings?.uid) {
              const newUid = window.roamAlphaAPI.util.generateUID();
              createBlock({
                parentUid: section.settings?.uid,
                node: {
                  text: "Open?",
                  uid: newUid,
                },
              });
              section.settings.open.uid = newUid;
              section.settings.open.value = true;
            }
          }
        }
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
          <span>{alias || blockText || titleRef.display}</span>
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

type PersonalSectionsProps = {
  config: LeftSidebarConfig["personal"];
};
const PersonalSections = ({
  config,
}: PersonalSectionsProps): JSX.Element | null => {
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

type GlobalSectionProps = {
  config: LeftSidebarConfig["global"];
};
const GlobalSection = ({ config }: GlobalSectionProps): JSX.Element | null => {
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

const LeftSidebarView = (): JSX.Element | null => {
  const config = getFormattedConfigTree().leftSidebar;

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

  const id = "dg-left-sidebar-root";
  let root = wrapper.querySelector(`#${id}`) as HTMLDivElement | null;
  if (!root) {
    root = document.createElement("div");
    root.id = id;
    root.className = "starred-pages";
    root.style.overflow = "scroll";
    root.onmousedown = (e) => e.stopPropagation();
    wrapper.appendChild(root);
  } else {
    root.className = "starred-pages";
    root.style.overflow = "scroll";
  }

  setTimeout(() => {
    try {
      ReactDOM.render(<LeftSidebarView />, root);
    } catch (e) {
      console.error("[DG][LeftSidebar] render error", e);
    }
  }, 500);
};

export default LeftSidebarView;
