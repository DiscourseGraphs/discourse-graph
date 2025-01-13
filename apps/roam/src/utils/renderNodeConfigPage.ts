import React from "react";
import CustomPanel from "roamjs-components/components/ConfigPanels/CustomPanel";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import SelectPanel from "roamjs-components/components/ConfigPanels/SelectPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import BlocksPanel from "roamjs-components/components/ConfigPanels/BlocksPanel";

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
