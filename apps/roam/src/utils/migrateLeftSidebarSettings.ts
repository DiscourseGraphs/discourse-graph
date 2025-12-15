import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import createBlock from "roamjs-components/writes/createBlock";
import { getFormattedConfigTree } from "./discourseConfigRef";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "./renderNodeConfigPage";
import refreshConfigTree from "./refreshConfigTree";

const migrateSectionChildren = async (
  children: { uid: string; text: string }[],
) => {
  const promises = children.map(async (child) => {
    const currentText = child.text;

    const titleFromUid = getPageTitleByPageUid(currentText);
    if (titleFromUid) {
      return;
    }

    const uidFromTitle = getPageUidByPageTitle(currentText);
    if (uidFromTitle) {
      try {
        await updateBlock({
          uid: child.uid,
          text: uidFromTitle,
        });
        console.log(
          `Migrated sidebar item "${currentText}" to UID "${uidFromTitle}"`,
        );
      } catch (e) {
        console.error(`Failed to migrate sidebar item "${currentText}"`, e);
      }
    }
  });

  await Promise.all(promises);
};

export const migrateLeftSidebarSettings = async () => {
  const leftSidebarSettings = getFormattedConfigTree().leftSidebar;

  if (!leftSidebarSettings.uid) return;

  if (leftSidebarSettings.sidebarMigrated.value) return;

  const configPageUid = getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE);
  if (!configPageUid) return;

  const globalChildren = leftSidebarSettings.global.children;
  if (globalChildren.length > 0) {
    await migrateSectionChildren(globalChildren);
  }

  const personalSections = leftSidebarSettings.personal.sections;
  for (const section of personalSections) {
    const children = section.children || [];
    if (children.length > 0) {
      await migrateSectionChildren(children);
    }
  }

  if (leftSidebarSettings.uid) {
    await createBlock({
      parentUid: leftSidebarSettings.uid,
      node: { text: "Sidebar Migrated" },
    });
  }

  refreshConfigTree();
};
