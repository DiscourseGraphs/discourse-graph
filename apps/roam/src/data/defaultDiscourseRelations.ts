import type { InputTextNode } from "roamjs-components/types/native";

const DEFAULT_RELATION_VALUES: InputTextNode[] = [
  {
    text: "Informs",
    children: [
      { text: "Source", children: [{ text: "_EVD-node" }] },
      { text: "Destination", children: [{ text: "_QUE-node" }] },
      { text: "complement", children: [{ text: "Informed By" }] },
      {
        text: "If",
        children: [
          {
            text: "And",
            children: [
              {
                text: "Page",
                children: [{ text: "is a", children: [{ text: "source" }] }],
              },
              {
                text: "Block",
                children: [
                  { text: "references", children: [{ text: "Page" }] },
                ],
              },
              {
                text: "Block",
                children: [
                  { text: "is in page", children: [{ text: "ParentPage" }] },
                ],
              },
              {
                text: "ParentPage",
                children: [
                  { text: "is a", children: [{ text: "destination" }] },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    text: "Supports",
    children: [
      { text: "Source", children: [{ text: "_EVD-node", children: [] }] },
      { text: "Destination", children: [{ text: "_CLM-node", children: [] }] },
      { text: "complement", children: [{ text: "Supported By" }] },
      {
        text: "If",
        children: [
          {
            text: "And",
            children: [
              {
                text: "Page",
                children: [
                  {
                    text: "is a",
                    children: [{ text: "source", children: [] }],
                  },
                ],
              },
              {
                text: "Block",
                children: [
                  {
                    text: "references",
                    children: [{ text: "Page", children: [] }],
                  },
                ],
              },
              {
                text: "SBlock",
                children: [
                  {
                    text: "references",
                    children: [{ text: "SPage", children: [] }],
                  },
                ],
              },
              {
                text: "SPage",
                children: [
                  {
                    text: "has title",
                    children: [{ text: "SupportedBy", children: [] }],
                  },
                ],
              },
              {
                text: "SBlock",
                children: [
                  {
                    text: "has child",
                    children: [{ text: "Block", children: [] }],
                  },
                ],
              },
              {
                text: "PBlock",
                children: [
                  {
                    text: "references",
                    children: [{ text: "ParentPage", children: [] }],
                  },
                ],
              },
              {
                text: "PBlock",
                children: [
                  {
                    text: "has child",
                    children: [{ text: "SBlock", children: [] }],
                  },
                ],
              },
              {
                text: "ParentPage",
                children: [
                  {
                    text: "is a",
                    children: [{ text: "destination", children: [] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    text: "Opposes",
    children: [
      { text: "Source", children: [{ text: "_EVD-node", children: [] }] },
      { text: "Destination", children: [{ text: "_CLM-node", children: [] }] },
      { text: "complement", children: [{ text: "Opposed By" }] },
      {
        text: "If",
        children: [
          {
            text: "And",
            children: [
              {
                text: "Page",
                children: [
                  {
                    text: "is a",
                    children: [{ text: "source", children: [] }],
                  },
                ],
              },
              {
                text: "Block",
                children: [
                  {
                    text: "references",
                    children: [{ text: "Page", children: [] }],
                  },
                ],
              },
              {
                text: "SBlock",
                children: [
                  {
                    text: "references",
                    children: [{ text: "SPage", children: [] }],
                  },
                ],
              },
              {
                text: "SPage",
                children: [
                  {
                    text: "has title",
                    children: [{ text: "OpposedBy", children: [] }],
                  },
                ],
              },
              {
                text: "SBlock",
                children: [
                  {
                    text: "has child",
                    children: [{ text: "Block", children: [] }],
                  },
                ],
              },
              {
                text: "PBlock",
                children: [
                  {
                    text: "references",
                    children: [{ text: "ParentPage", children: [] }],
                  },
                ],
              },
              {
                text: "PBlock",
                children: [
                  {
                    text: "has child",
                    children: [{ text: "SBlock", children: [] }],
                  },
                ],
              },
              {
                text: "ParentPage",
                children: [
                  {
                    text: "is a",
                    children: [{ text: "destination", children: [] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export default DEFAULT_RELATION_VALUES;
