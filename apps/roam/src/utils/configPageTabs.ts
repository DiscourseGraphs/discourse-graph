import { OnloadArgs } from "roamjs-components/types";
import MultiTextPanel from "roamjs-components/components/ConfigPanels/MultiTextPanel";
import NumberPanel from "roamjs-components/components/ConfigPanels/NumberPanel";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import CustomPanel from "roamjs-components/components/ConfigPanels/CustomPanel";
import SelectPanel from "roamjs-components/components/ConfigPanels/SelectPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import DiscourseNodeConfigPanel from "~/components/settings/DiscourseNodeConfigPanel";
import DiscourseRelationConfigPanel from "~/components/settings/DiscourseRelationConfigPanel";
import DEFAULT_RELATION_VALUES from "~/data/defaultDiscourseRelations";
import { ConfigTab } from "roamjs-components/components/ConfigPage";
import {
  Field,
  CustomField,
  SelectField,
} from "roamjs-components/components/ConfigPanels/types";
import PageGroupsPanel from "~/components/settings/PageGroupPanel";

export const configPageTabs = (args: OnloadArgs): ConfigTab[] => [
  {
    id: "home",
    fields: [
      {
        title: "trigger",
        description:
          "The trigger to create the node menu. Must refresh after editing",
        defaultValue: "\\",
        // @ts-ignore
        Panel: TextPanel,
      },
    ],
  },
  {
    id: "grammar",
    fields: [
      // @ts-ignore
      {
        title: "nodes",
        Panel: CustomPanel,
        description: "The types of nodes in your discourse graph",
        options: {
          component: DiscourseNodeConfigPanel,
        },
      } as Field<CustomField>,
      // @ts-ignore
      {
        title: "relations",
        Panel: CustomPanel,
        description: "The types of relations in your discourse graph",
        defaultValue: DEFAULT_RELATION_VALUES,
        options: {
          component: DiscourseRelationConfigPanel,
        },
      } as Field<CustomField>,
    ],
  },
  {
    id: "export",
    fields: [
      {
        title: "max filename length",
        // @ts-ignore
        Panel: NumberPanel,
        description: "Set the maximum name length for markdown file exports",
        defaultValue: 64,
      },
      {
        title: "remove special characters",
        // @ts-ignore
        Panel: FlagPanel,
        description:
          "Whether or not to remove the special characters in a file name",
      },
      {
        title: "simplified filename",
        // @ts-ignore
        Panel: FlagPanel,
        description:
          "For discourse nodes, extract out the {content} from the page name to become the file name",
      },
      {
        title: "frontmatter",
        // @ts-ignore
        Panel: MultiTextPanel,
        description:
          "Specify all the lines that should go to the Frontmatter of the markdown file",
      },
      {
        title: "resolve block references",
        // @ts-ignore
        Panel: FlagPanel,
        description:
          "Replaces block references in the markdown content with the block's content",
      },
      {
        title: "resolve block embeds",
        // @ts-ignore
        Panel: FlagPanel,
        description:
          "Replaces block embeds in the markdown content with the block's content tree",
      },
      // @ts-ignore
      {
        title: "link type",
        Panel: SelectPanel,
        description: "How to format links that appear in your export.",
        options: {
          items: ["alias", "wikilinks", "roam url"],
        },
      } as Field<SelectField>,
      {
        title: "append referenced node",
        // @ts-ignore
        Panel: FlagPanel,
        description:
          "If a referenced node is defined in a node's format, it will be appended to the discourse context",
      },
    ],
  },
  {
    id: "suggestive-mode",
    fields: [
      {
        title: "Include Current Page Relations",
        // @ts-ignore
        Panel: FlagPanel,
        description:
          "Include relations from pages referenced on the current page",
      },
      {
        title: "Include Parent and Child Blocks",
        // @ts-ignore
        Panel: FlagPanel,
        description: "Include relations from parent and child blocks",
      },
      // @ts-ignore
      {
        title: "Page Groups",
        Panel: CustomPanel,
        description: "Set page groups to use for discourse suggestions",
        options: {
          component: PageGroupsPanel,
        },
      } as Field<CustomField>,
    ],
  },
];
