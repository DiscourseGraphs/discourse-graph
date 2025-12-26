import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import extractRef from "roamjs-components/util/extractRef";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import React from "react";

export const parseReference = (text: string) => {
  const extracted = extractRef(text);
  if (text.startsWith("((") && text.endsWith("))")) {
    return { type: "block" as const, uid: extracted, display: text };
  } else {
    return { type: "page" as const, display: text };
  }
};

export const truncate = (s: string, max: number | undefined): string => {
  if (!max || max <= 0) return s;
  return s.length > max ? `${s.slice(0, max)}...` : s;
};

export const openTarget = async (e: React.MouseEvent, targetUid: string) => {
  e.preventDefault();
  e.stopPropagation();
  const target = parseReference(targetUid);
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

  if (e.shiftKey) {
    await window.roamAlphaAPI.ui.rightSidebar.addWindow({
      // @ts-expect-error - todo test
      // eslint-disable-next-line @typescript-eslint/naming-convention
      window: { type: "outline", "block-uid": targetUid },
    });
  } else {
    await window.roamAlphaAPI.ui.mainWindow.openPage({
      page: { uid: targetUid },
    });
  }
};

export const SectionChildren = ({
  childrenNodes,
  truncateAt,
}: {
  childrenNodes: { uid: string; text: string; alias?: { value: string } }[];
  truncateAt?: number;
}) => {
  if (!childrenNodes?.length) return null;
  return (
    <>
      {childrenNodes.map((child) => {
        const ref = parseReference(child.text);
        const alias = child.alias?.value;
        const display =
          ref.type === "page"
            ? getPageTitleByPageUid(ref.display)
            : getTextByBlockUid(ref.uid);
        const label = alias || truncate(display, truncateAt);
        const onClick = (e: React.MouseEvent) => {
          return void openTarget(e, child.text);
        };
        return (
          <div key={child.uid} className="pl-8 pr-2.5">
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
