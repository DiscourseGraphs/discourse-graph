import type { TreeNode } from "roamjs-components/types";
import type { CrossAppNode } from "@repo/database/crossAppNodeContract";
import { buildFullMarkdown } from "./convertRoamNodeToFullContent";

/**
 * Example Roam page tree used to show the markdown emitted for a `full` content
 * variant. The tree mirrors `getFullTreeByParentUid(pageUid).children` from a
 * real Roam page, and the exported value is type-checked against the cross-app
 * node contract.
 *
 * Source Roam page:
 * https://roamresearch.com/#/app/plugin-testing-akamatsulab2/page/dnHNmYwe5
 *
 * Observed markdown output:
 *
 * # [[CLM]] - Actin assembly peaks 8 seconds before endocytic scission
 *
 * - ## Source of Claim [ℹ](link to [[@source]], name, URL, etc)
 *     - [[[[EVD]] - Membrane invagination occurred ~6 seconds after scission protein (spHob1-GFP) was detected in budding yeast cells - [[@sun2019direct]]]]
 *     - [[[[EVD]] - At fission yeast endocytic sites, scission protein (spHob1) first detected ~2 seconds before initiation of membrane invagination - [[@sun2019direct]]]]
 *     - [[[[EVD]] - Actin appearance occurred 9 (+/-2) seconds prior to patch formation and disappears 10 (+/-2) seconds following patch development. [[@sirotkin2010quantitative]]]]
 *     - [[[[EVD]] - At zero seconds, 7000 actin proteins associated with endocytic invagination - [[@sirotkin2010quantitative]]]]
 *     - actin assembly peaks (x) seconds before/after endocytic scission
 *         - [[[[CLM]] - Actin assembly peaks 8 seconds before endocytic scission]]
 * - ## Notes
 *     - ![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fakamatsulab%2F9u2TJGJarR.png?alt=media&token=3c5caff2-7fd5-4df0-94b8-a0d897eb219f)
 */

type SerializedTreeNode = Omit<TreeNode, "children" | "editTime"> & {
  children: SerializedTreeNode[];
  editTime: string;
};

const deserializeTreeNode = (node: SerializedTreeNode): TreeNode => ({
  ...node,
  editTime: new Date(node.editTime),
  children: node.children.map(deserializeTreeNode),
});

const title =
  "[[CLM]] - Actin assembly peaks 8 seconds before endocytic scission";

const serializedBlocks: SerializedTreeNode[] = [
  {
    text: "Source of Claim [ℹ](((JtVWq1Cwl)))",
    open: true,
    order: 0,
    uid: "yxM5yI07g",
    heading: 2,
    viewType: "bullet",
    blockViewType: "outline",
    editTime: "2024-02-29T21:28:17.505Z",
    props: {
      imageResize: {},
      iframe: {},
    },
    textAlign: "left",
    children: [
      {
        text: "[[[[EVD]] - Membrane invagination occurred ~6 seconds after scission protein (spHob1-GFP) was detected in budding yeast cells - [[@sun2019direct]]]]",
        open: true,
        order: 0,
        uid: "tZnNCIgsk",
        heading: 0,
        viewType: "bullet",
        blockViewType: "outline",
        editTime: "2024-03-25T05:40:43.601Z",
        props: {
          imageResize: {},
          iframe: {},
        },
        textAlign: "left",
        children: [],
        parents: [0],
      },
      {
        text: "[[[[EVD]] - At fission yeast endocytic sites, scission protein (spHob1) first detected ~2 seconds before initiation of membrane invagination - [[@sun2019direct]]]]",
        open: true,
        order: 1,
        uid: "i-rS06THC",
        heading: 0,
        viewType: "bullet",
        blockViewType: "outline",
        editTime: "2024-02-29T21:38:44.920Z",
        props: {
          imageResize: {},
          iframe: {},
        },
        textAlign: "left",
        children: [],
        parents: [0],
      },
      {
        text: "[[[[EVD]] - Actin appearance occurred 9 (+/-2) seconds prior to patch formation and disappears 10 (+/-2) seconds following patch development. [[@sirotkin2010quantitative]]]]",
        open: true,
        order: 2,
        uid: "fiWpNvVM8",
        heading: 0,
        viewType: "bullet",
        blockViewType: "outline",
        editTime: "2024-02-29T21:38:54.473Z",
        props: {
          imageResize: {},
          iframe: {},
        },
        textAlign: "left",
        children: [],
        parents: [0],
      },
      {
        text: "[[[[EVD]] - At zero seconds, 7000 actin proteins associated with endocytic invagination - [[@sirotkin2010quantitative]]]]",
        open: true,
        order: 3,
        uid: "nz8-Sd5a5",
        heading: 0,
        viewType: "bullet",
        blockViewType: "outline",
        editTime: "2024-02-29T21:39:03.540Z",
        props: {
          imageResize: {},
          iframe: {},
        },
        textAlign: "left",
        children: [],
        parents: [0],
      },
      {
        text: "",
        open: true,
        order: 4,
        uid: "fEcOIBDD7",
        heading: 0,
        viewType: "bullet",
        blockViewType: "outline",
        editTime: "2024-02-29T21:39:31.790Z",
        props: {
          imageResize: {},
          iframe: {},
        },
        textAlign: "left",
        children: [],
        parents: [0],
      },
      {
        text: "actin assembly peaks (x) seconds before/after endocytic scission",
        open: true,
        order: 5,
        uid: "xgfRsZ-Xb",
        heading: 0,
        viewType: "bullet",
        blockViewType: "outline",
        editTime: "2024-02-29T21:38:25.591Z",
        props: {
          imageResize: {},
          iframe: {},
        },
        textAlign: "left",
        children: [
          {
            text: "[[[[CLM]] - Actin assembly peaks 8 seconds before endocytic scission]]",
            open: true,
            order: 0,
            uid: "URYHjVOwB",
            heading: 0,
            viewType: "bullet",
            blockViewType: "outline",
            editTime: "2024-02-29T21:48:24.324Z",
            props: {
              imageResize: {},
              iframe: {},
            },
            textAlign: "left",
            children: [],
            parents: [0],
          },
        ],
        parents: [0],
      },
    ],
    parents: [],
  },
  {
    text: "Notes",
    open: true,
    order: 1,
    uid: "LVRwULrGC",
    heading: 2,
    viewType: "bullet",
    blockViewType: "outline",
    editTime: "2024-02-29T21:28:17.509Z",
    props: {
      imageResize: {},
      iframe: {},
    },
    textAlign: "left",
    children: [
      {
        text: "![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fakamatsulab%2F9u2TJGJarR.png?alt=media&token=3c5caff2-7fd5-4df0-94b8-a0d897eb219f)",
        open: true,
        order: 0,
        uid: "aMAPTRui2",
        heading: 0,
        viewType: "bullet",
        blockViewType: "outline",
        editTime: "2024-03-07T22:57:13.411Z",
        props: {
          imageResize: {},
          iframe: {},
        },
        textAlign: "left",
        children: [],
        parents: [0],
      },
    ],
    parents: [],
  },
];

const blocks = serializedBlocks.map(deserializeTreeNode);

export const roamClaimFullMarkdownExample: {
  title: string;
  blocks: TreeNode[];
  full: CrossAppNode["content"]["full"];
} = {
  title,
  blocks,
  full: {
    format: "text/markdown",
    value: buildFullMarkdown({ title, blocks }),
  },
};
