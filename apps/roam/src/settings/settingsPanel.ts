import { OnloadArgs } from "roamjs-components/types";
import { NodeMenuTriggerComponent } from "~/components/DiscourseNodeMenu";
import { SettingsPanel } from "~/components/settings/Settings";

export const createSettingsPanel = (onloadArgs: OnloadArgs) => {
  const { extensionAPI } = onloadArgs;
  extensionAPI.settings.panel.create({
    tabTitle: "Discourse Graphs",
    settings: [
      {
        id: "settings-popup",
        name: "Settings",
        description: "",
        action: {
          type: "reactComponent",
          component: () => SettingsPanel({ onloadArgs }),
        },
      },
      {
        id: "discourse-node-menu-trigger",
        name: "Personal Node Menu Trigger",
        action: {
          type: "reactComponent",
          component: () => NodeMenuTriggerComponent(extensionAPI),
        },
        description:
          "Override the global trigger for the Discourse Node Menu. Must refresh after editing.",
      },
      {
        id: "async-q",
        name: "Use Backend Query (Beta)",
        description:
          "This will use Roam's Backend Query. It helps prevent the UI from freezing during large queries but is still in beta and may occasionally produce inaccurate results.",
        action: {
          type: "switch",
        },
      },
    ],
  });
};
