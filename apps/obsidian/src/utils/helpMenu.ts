import { Menu } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { FeedbackModal } from "~/components/FeedbackModal";
import { DOCS_URL, COMMUNITY_URL } from "~/constants";

export const showHelpMenu = ({
  plugin,
  event,
}: {
  plugin: DiscourseGraphPlugin;
  event: MouseEvent;
}): void => {
  const menu = new Menu();

  menu.addItem((item) =>
    item
      .setTitle("Send feedback")
      .setIcon("message-square")
      .onClick(() => {
        new FeedbackModal(plugin.app, plugin).open();
      }),
  );

  menu.addItem((item) =>
    item
      .setTitle("Docs")
      .setIcon("book")
      .onClick(() => {
        window.open(DOCS_URL, "_blank", "noopener,noreferrer");
      }),
  );

  menu.addItem((item) =>
    item
      .setTitle("Community")
      .setIcon("users")
      .onClick(() => {
        window.open(COMMUNITY_URL, "_blank", "noopener,noreferrer");
      }),
  );

  menu.addItem((item) =>
    item
      .setTitle("Settings")
      .setIcon("settings")
      .onClick(() => {
        plugin.app.setting.open();
        plugin.app.setting.openTabById(plugin.manifest.id);
      }),
  );

  menu.showAtMouseEvent(event);
};
