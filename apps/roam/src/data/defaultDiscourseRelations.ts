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
              {
                text: "Node Positions",
                children: [
                  { text: "0", children: [{ text: "100 57" }] },
                  { text: "1", children: [{ text: "100 208" }] },
                  { text: "2", children: [{ text: "100 345" }] },
                  { text: "source", children: [{ text: "281 57" }] },
                  { text: "destination", children: [{ text: "281 345" }] },
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
              {
                text: "Node Positions",
                children: [
                  { text: "0", children: [{ text: "250 325" }] },
                  { text: "1", children: [{ text: "100 325" }] },
                  { text: "2", children: [{ text: "100 200" }] },
                  { text: "3", children: [{ text: "250 200" }] },
                  { text: "4", children: [{ text: "400 200" }] },
                  { text: "5", children: [{ text: "100 75" }] },
                  { text: "6", children: [{ text: "250 75" }] },
                  { text: "source", children: [{ text: "400 325" }] },
                  { text: "destination", children: [{ text: "400 75" }] },
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
              {
                text: "Node Positions",
                children: [
                  { text: "0", children: [{ text: "250 325" }] },
                  { text: "1", children: [{ text: "100 325" }] },
                  { text: "2", children: [{ text: "100 200" }] },
                  { text: "3", children: [{ text: "250 200" }] },
                  { text: "4", children: [{ text: "400 200" }] },
                  { text: "5", children: [{ text: "100 75" }] },
                  { text: "6", children: [{ text: "250 75" }] },
                  { text: "source", children: [{ text: "400 325" }] },
                  { text: "destination", children: [{ text: "400 75" }] },
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
