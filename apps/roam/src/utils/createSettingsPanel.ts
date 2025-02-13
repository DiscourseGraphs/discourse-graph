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
    ],
  });
};
