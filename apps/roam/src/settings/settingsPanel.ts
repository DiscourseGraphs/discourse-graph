import { OnloadArgs } from "roamjs-components/types";
import { SettingsPanel } from "~/components/settings/Settings";

export const createSettingsPanel = (
  extensionAPI: OnloadArgs["extensionAPI"],
) => {
  extensionAPI.settings.panel.create({
    tabTitle: "Discourse Graphs",
    settings: [
      {
        id: "settings-popup",
        name: "Settings",
        description: "",
        action: {
          type: "reactComponent",
          component: () => SettingsPanel({ extensionAPI }),
        },
      },
    ],
  });
};
