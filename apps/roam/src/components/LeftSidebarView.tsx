import React, { useMemo, useState } from "react";
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
  if (text.startsWith("((") && text.endsWith("))")) {
    return { type: "block" as const, uid: extracted, display: text };
  } else {
    return { type: "page" as const, title: extracted, display: extracted };
  }
};

const truncate = (s: string, max: number | undefined): string => {
  if (!max || max <= 0) return s;
  return s.length > max ? `${s.slice(0, max)}...` : s;
};

const openTarget = async (e: React.MouseEvent, sectionTitle: string) => {
  e.preventDefault();
  e.stopPropagation();
  const target = parseReference(sectionTitle);

  if (target.type === "block") {
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
      // @ts-expect-error - todo test
      // eslint-disable-next-line @typescript-eslint/naming-convention
      window: { type: "outline", "block-uid": uid },
    });
  } else {
    await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid } });
  }
};

const toggleFoldedState = ({
  isOpen,
  setIsOpen,
  folded,
  parentUid,
}: {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  folded: { uid?: string; value: boolean };
  parentUid: string;
}) => {
  if (isOpen) {
    setIsOpen(false);
    if (folded.uid) {
      void deleteBlock(folded.uid);
      folded.uid = undefined;
      folded.value = false;
    }
  } else {
    setIsOpen(true);
    const newUid = window.roamAlphaAPI.util.generateUID();
    void createBlock({
      parentUid,
      node: { text: "Folded", uid: newUid },
    });
    folded.uid = newUid;
    folded.value = true;
  }
};

const SectionChildren = ({
  childrenNodes,
  truncateAt,
}: {
  childrenNodes: { uid: string; text: string }[];
  truncateAt?: number;
}) => {
  if (!childrenNodes?.length) return null;
  return (
    <>
      {childrenNodes.map((child) => {
        const ref = parseReference(child.text);
        const label = truncate(ref.display, truncateAt);
        const onClick = (e: React.MouseEvent) => {
          return void openTarget(e, child.text);
        };
        return (
          <div key={child.uid} className="py-1 pl-1">
            <div
              className={
                "section-child-item page cursor-pointer rounded-sm leading-normal text-gray-600"
              }
              onClick={onClick}
            >
              {label}
            </div>
          </div>
        );
      })}
    </>
  );
};

const PersonalSectionItem = ({
  section,
}: {
  section: LeftSidebarPersonalSectionConfig;
}) => {
  const titleRef = parseReference(section.text);
  const blockText = useMemo(
    () =>
      titleRef.type === "block" ? getTextByBlockUid(titleRef.uid) : undefined,
    [titleRef],
  );
  const truncateAt = section.settings?.truncateResult.value;
  const [isOpen, setIsOpen] = useState<boolean>(
    !!section.settings?.folded.value || false,
  );
  const alias = section.settings?.alias?.value;

  if (section.sectionWithoutSettingsAndChildren) {
    const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
      return void openTarget(e, section.text);
    };
    return (
      <>
        <div
          className="sidebar-title-button cursor-pointer rounded-sm py-1 font-semibold leading-normal"
          onClick={onClick}
        >
          {blockText || titleRef.title}
        </div>
        <hr className="mb-1 mt-0.5 rounded border border-solid border-[#CED9E0]" />
      </>
    );
  }

  const handleTitleClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      return void openTarget(e, section.text);
    }
    if (!section.settings) return;

    toggleFoldedState({
      isOpen,
      setIsOpen,
      folded: section.settings.folded,
      parentUid: section.settings.uid || "",
    });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    return void openTarget(e, section.text);
  };

  return (
    <>
      <div className="sidebar-title-button flex w-full cursor-pointer items-center border-none bg-transparent py-1 font-semibold outline-none transition-colors duration-200 ease-in">
        <div className="flex w-full items-center justify-between">
          <span onDoubleClick={handleDoubleClick}>
            {alias || blockText || titleRef.display}
          </span>
          {(section.children?.length || 0) > 0 && (
            <span onClick={handleTitleClick}>
              <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
            </span>
          )}
        </div>
      </div>
      <hr className="mb-1 mt-0.5 rounded border border-solid border-[#CED9E0]" />
      <Collapse isOpen={isOpen}>
        <SectionChildren
          childrenNodes={section.children || []}
          truncateAt={truncateAt}
        />
      </Collapse>
    </>
  );
};

const PersonalSections = ({
  config,
}: {
  config: LeftSidebarConfig["personal"];
}) => {
  const sections = config.sections || [];
  if (!sections.length) return null;
  return (
    <div className="personal-left-sidebar-sections">
      {sections.map((s) => (
        <PersonalSectionItem key={s.uid} section={s} />
      ))}
    </div>
  );
};

const GlobalSection = ({ config }: { config: LeftSidebarConfig["global"] }) => {
  const [isOpen, setIsOpen] = useState<boolean>(!!config.folded.value);
  if (!config.children?.length) return null;
  const isCollapsable = config.collapsable.value;

  return (
    <>
      <div
        className="sidebar-title-button flex w-full cursor-pointer items-center border-none bg-transparent py-1 font-semibold outline-none transition-colors duration-200 ease-in"
        onClick={() => {
          if (!isCollapsable) return;
          toggleFoldedState({
            isOpen,
            setIsOpen,
            folded: config.folded,
            parentUid: config.uid,
          });
        }}
      >
        <div className="flex w-full items-center justify-between">
          <span>Global</span>
          {isCollapsable && (
            <span>
              <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
            </span>
          )}
        </div>
      </div>
      <hr className="mb-1 mt-0.5 rounded border border-solid border-[#CED9E0]" />
      {isCollapsable ? (
        <Collapse isOpen={isOpen}>
          <SectionChildren childrenNodes={config.children} />
        </Collapse>
      ) : (
        <SectionChildren childrenNodes={config.children} />
      )}
    </>
  );
};

const LeftSidebarView = () => {
  const config = useMemo(() => getFormattedConfigTree().leftSidebar, []);

  return (
    <>
      <GlobalSection config={config.global} />
      <PersonalSections config={config.personal} />
    </>
  );
};

export const mountLeftSidebar = (wrapper: HTMLElement): void => {
  if (!wrapper) return;
  wrapper.innerHTML = "";

  const id = "dg-left-sidebar-root";
  let root = wrapper.querySelector(`#${id}`) as HTMLDivElement;
  if (!root) {
    const existingStarred = wrapper.querySelector(".starred-pages");
    if (existingStarred) {
      existingStarred.remove();
    }
    root = document.createElement("div");
    root.id = id;
    root.className = "starred-pages overflow-scroll";
    root.onmousedown = (e) => e.stopPropagation();
    wrapper.appendChild(root);
  } else {
    root.className = "starred-pages overflow-scroll";
  }
  ReactDOM.render(<LeftSidebarView />, root);
};

export default LeftSidebarView;
