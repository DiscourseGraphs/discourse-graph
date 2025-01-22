import { OnloadArgs } from "roamjs-components/types";
import { NodeMenuTriggerComponent } from "~/components/DiscourseNodeMenu";
import { SettingsPanel } from "~/components/settings/Settings";
import { ThreeStateSwitch } from "~/components/settings/PosthogPermissionAlert";

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
        id: "posthog-session-recording",
        name: "Permission to screen record Roam for a Week?",
        description:
          "We would like to screen record your usage of Roam for a week. We would use this data strictly for internal purposes like using it to improve the onboarding process, fixing usability issues and areas where user might need additional guidance. The data won't be shared with anybody, and will be automatically switched off after a week.",
        action: {
          type: "reactComponent",
          component: () => ThreeStateSwitch({ onloadArgs }),
        },
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
