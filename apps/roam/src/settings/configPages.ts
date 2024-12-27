import React from "react";
import CustomPanel from "roamjs-components/components/ConfigPanels/CustomPanel";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import SelectPanel from "roamjs-components/components/ConfigPanels/SelectPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import BlocksPanel from "roamjs-components/components/ConfigPanels/BlocksPanel";
import MultiTextPanel from "roamjs-components/components/ConfigPanels/MultiTextPanel";
import NumberPanel from "roamjs-components/components/ConfigPanels/NumberPanel";
import {
  Field,
  CustomField,
  TextField,
  SelectField,
  FieldPanel,
  FlagField,
} from "roamjs-components/components/ConfigPanels/types";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { OnloadArgs } from "roamjs-components/types";
import { getSubTree } from "roamjs-components/util";
import {
  DiscourseNodeIndex,
  DiscourseNodeSpecification,
  DiscourseNodeAttributes,
  DiscourseNodeCanvasSettings,
} from "~/components";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import { render as configPageRender } from "roamjs-components/components/ConfigPage";
import DiscourseNodeConfigPanel from "~/components/settings/DiscourseNodeConfigPanel";
import DiscourseRelationConfigPanel from "~/components/settings/DiscourseRelationConfigPanel";
import DEFAULT_RELATION_VALUES from "~/data/defaultDiscourseRelations";
import {
  onPageRefObserverChange,
  previewPageRefHandler,
  overlayPageRefHandler,
} from "~/utils/pageRefObserverHandlers";
import { ConfigTab } from "roamjs-components/components/ConfigPage";

export const DISCOURSE_CONFIG_PAGE_TITLE = "roam/js/discourse-graph";
export const NODE_CONFIG_PAGE_TITLE = "discourse-graph/nodes/";

export const renderNodeConfigPage = ({
  title,
  h1,
  onloadArgs,
}: {
  title: string;
  h1: HTMLHeadingElement;
  onloadArgs: OnloadArgs;
}) => {
  const nodeText = title.substring("discourse-graph/nodes/".length);
  const allNodes = getDiscourseNodes();
  const node = allNodes.find(({ text }) => text === nodeText);
  if (node) {
    const renderNode = () =>
      configPageRender({
        h: h1,
        title,
        config: [
          // @ts-ignore
          {
            title: "Index",
            description: "Index of all of the pages in your graph of this type",
            Panel: CustomPanel,
            options: {
              component: ({ uid }) =>
                React.createElement(DiscourseNodeIndex, {
                  node,
                  parentUid: uid,
                  onloadArgs,
                }),
            },
          } as Field<CustomField>,
          // @ts-ignore
          {
            title: "Format",
            description: `DEPRACATED - Use specification instead. The format ${nodeText} pages should have.`,
            defaultValue: "\\",
            Panel: TextPanel,
            options: {
              placeholder: `Include "{content}" in format`,
            },
          } as Field<TextField>,
          // @ts-ignore
          {
            title: "Specification",
            description: `The conditions specified to identify a ${nodeText} node.`,
            Panel: CustomPanel,
            options: {
              component: ({ uid }) =>
                React.createElement(DiscourseNodeSpecification, {
                  node,
                  parentUid: uid,
                }),
            },
          } as Field<CustomField>,
          {
            title: "Shortcut",
            description: `The trigger to quickly create a ${nodeText} page from the node menu.`,
            defaultValue: "\\",
            // @ts-ignore
            Panel: TextPanel,
          },
          {
            title: "Description",
            description: `Describing what the ${nodeText} node represents in your graph.`,
            // @ts-ignore
            Panel: TextPanel,
          },
          {
            title: "Template",
            description: `The template that auto fills ${nodeText} page when generated.`,
            // @ts-ignore
            Panel: BlocksPanel,
          },
          // @ts-ignore
          {
            title: "Attributes",
            description: `A set of derived properties about the node based on queryable data.`,
            Panel: CustomPanel,
            options: {
              component: DiscourseNodeAttributes,
            },
          } as Field<CustomField>,
          // @ts-ignore
          {
            title: "Overlay",
            description: `Select which attribute is used for the Discourse Overlay`,
            Panel: SelectPanel,
            options: {
              items: () =>
                getSubTree({
                  parentUid: getPageUidByPageTitle(title),
                  key: "Attributes",
                }).children.map((c) => c.text),
            },
          } as Field<SelectField>,
          // @ts-ignore
          {
            title: "Canvas",
            description: `Various options for this node in the Discourse Canvas`,
            Panel: CustomPanel,
            options: {
              component: DiscourseNodeCanvasSettings,
            },
          } as Field<CustomField>,
          // @ts-ignore
          {
            title: "Graph Overview",
            Panel: FlagPanel,
            description: `Whether to color the node in the graph overview based on canvas color.  This is based on the node's plain title as described by a \`has title\` condition in its specification.`,
            defaultValue: true,
          } as FieldPanel<FlagField>,
        ],
      });

    renderNode();
  }
};

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
      // @ts-ignore
      {
        title: "disable sidebar open",
        description: "Disable opening new nodes in the sidebar when created",
        Panel: FlagPanel,
      } as Field<FlagField>,
      // @ts-ignore
      {
        title: "preview",
        description:
          "Whether or not to display page previews when hovering over page refs",
        Panel: FlagPanel,
        options: {
          onChange: onPageRefObserverChange(previewPageRefHandler),
        },
      } as Field<FlagField>,
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
      // @ts-ignore
      {
        title: "overlay",
        Panel: FlagPanel,
        // description:
        //   "Whether to overlay discourse context information over node references",
        description: "Currently disabled. Being reworked.",
        disabled: true,
        options: {
          onChange: (val) => {
            onPageRefObserverChange((s) => overlayPageRefHandler(s, args))(val);
          },
        },
      } as Field<FlagField>,
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
];
