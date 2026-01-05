/* eslint-disable @typescript-eslint/naming-convention */
import type {
  CanvasSettings,
  SuggestiveRules,
  DiscourseNodeSettings,
  FeatureFlags,
  ExportSettings,
  PageGroup,
  SuggestiveModeGlobalSettings,
  LeftSidebarGlobalSettings,
  GlobalSettings,
  PersonalSection,
  LeftSidebarPersonalSettings,
  QueryFilter,
  QuerySettings,
  PersonalSettings,
  GithubSettings,
  RoamBlock,
} from "./zodSchema";

const canvasSettings: CanvasSettings = {
  color: "#4A90D9",
  alias: "CLM",
  "key-image": true,
  "key-image-option": "query-builder",
  "query-builder-alias": "Key Image Query",
};

const suggestiveRules: SuggestiveRules = {
  template: [
    { text: "Summary::", children: [] },
    { text: "Key Points::", children: [] },
  ],
  embeddingRef: "((block-uid-123))",
  embeddingRefUid: "block-uid-123",
  isFirstChild: {
    uid: "first-child-uid",
    value: true,
  },
};

const discourseNodeSettings: DiscourseNodeSettings = {
  text: "Claim",
  type: "discourse-graph/nodes/claim",
  format: "[[CLM]] - {content}",
  shortcut: "C",
  tag: "#claim",
  description: "A statement or assertion that can be supported or refuted",
  specification: [
    {
      type: "has title",
      text: "starts with [[CLM]]",
    },
  ],
  specificationUid: "spec-uid-123",
  template: [
    { text: "Summary::", children: [] },
    { text: "Evidence::", children: [] },
    { text: "Counterarguments::", children: [] },
  ],
  templateUid: "template-uid-123",
  canvasSettings: {
    color: "#4A90D9",
    alias: "CLM",
  },
  graphOverview: true,
  attributes: {
    Status: "status-attr-uid",
    Confidence: "confidence-attr-uid",
  },
  overlay: "Status",
  index: [
    {
      type: "filter",
      condition: "has attribute",
      attribute: "Status",
    },
  ],
  indexUid: "index-uid-123",
  suggestiveRules: {
    template: [],
    embeddingRef: "((embed-ref))",
    embeddingRefUid: "embed-ref",
    isFirstChild: {
      uid: "is-first-child-uid",
      value: false,
    },
  },
  embeddingRef: "((main-embed-ref))",
  embeddingRefUid: "main-embed-ref",
  isFirstChild: {
    uid: "main-first-child-uid",
    value: true,
  },
  backedBy: "user",
};

const featureFlags: FeatureFlags = {
  "Enable Left Sidebar": true,
  "Suggestive Mode Enabled": true,
  "Reified Relation Triples": false,
};

const defaultFeatureFlags: FeatureFlags = {
  "Enable Left Sidebar": false,
  "Suggestive Mode Enabled": false,
  "Reified Relation Triples": false,
};

const exportSettings: ExportSettings = {
  "Remove Special Characters": true,
  "Resolve Block References": true,
  "Resolve Block Embeds": false,
  "Append Referenced Node": true,
  "Link Type": "wikilinks",
  "Max Filename Length": 128,
  Frontmatter: [
    "title: {{page-title}}",
    "date: {{date}}",
    "tags: {{tags}}",
    "type: discourse-node",
  ],
};

const pageGroup: PageGroup = {
  name: "Research Papers",
  pages: ["page-uid-1", "page-uid-2", "page-uid-3"],
};

const suggestiveModeGlobalSettings: SuggestiveModeGlobalSettings =
  {
    "Include Current Page Relations": true,
    "Include Parent And Child Blocks": true,
    "Page Groups": [
      {
        name: "Research Papers",
        pages: ["paper-1-uid", "paper-2-uid"],
      },
      {
        name: "Meeting Notes",
        pages: ["meeting-1-uid", "meeting-2-uid", "meeting-3-uid"],
      },
    ],
  };

const leftSidebarGlobalSettings: LeftSidebarGlobalSettings = {
  Children: ["daily-notes-uid", "quick-capture-uid", "inbox-uid"],
  Settings: {
    Collapsable: true,
    Folded: false,
  },
};

const globalSettings: GlobalSettings = {
  Trigger: ";;",
  "Canvas Page Format": "Canvas - {date} - {title}",
  "Left Sidebar": {
    Children: ["daily-notes-uid", "quick-capture-uid", "inbox-uid"],
    Settings: {
      Collapsable: true,
      Folded: false,
    },
  },
  Export: {
    "Remove Special Characters": true,
    "Resolve Block References": true,
    "Resolve Block Embeds": false,
    "Append Referenced Node": true,
    "Link Type": "wikilinks",
    "Max Filename Length": 128,
    Frontmatter: ["title: {{page-title}}", "date: {{date}}"],
  },
  "Suggestive Mode": {
    "Include Current Page Relations": true,
    "Include Parent And Child Blocks": true,
    "Page Groups": [
      {
        name: "Research",
        pages: ["research-uid-1", "research-uid-2"],
      },
    ],
  },
};

const defaultGlobalSettings: GlobalSettings = {
  Trigger: "",
  "Canvas Page Format": "",
  "Left Sidebar": {
    Children: [],
    Settings: {
      Collapsable: false,
      Folded: false,
    },
  },
  Export: {
    "Remove Special Characters": false,
    "Resolve Block References": false,
    "Resolve Block Embeds": false,
    "Append Referenced Node": false,
    "Link Type": "alias",
    "Max Filename Length": 64,
    Frontmatter: [],
  },
  "Suggestive Mode": {
    "Include Current Page Relations": false,
    "Include Parent And Child Blocks": false,
    "Page Groups": [],
  },
};

const personalSection: PersonalSection = {
  Children: [
    { Page: "daily-notes-uid", Alias: "Daily Notes" },
    { Page: "inbox-uid", Alias: "Inbox" },
    { Page: "projects-uid", Alias: "" },
  ],
  Settings: {
    "Truncate-result?": 100,
    Folded: false,
  },
};

const leftSidebarPersonalSettings: LeftSidebarPersonalSettings = {
  "My Workspace": {
    Children: [
      { Page: "daily-notes-uid", Alias: "Daily Notes" },
      { Page: "inbox-uid", Alias: "Inbox" },
    ],
    Settings: {
      "Truncate-result?": 75,
      Folded: false,
    },
  },
  Research: {
    Children: [
      { Page: "papers-uid", Alias: "Papers" },
      { Page: "notes-uid", Alias: "Notes" },
      { Page: "ideas-uid", Alias: "Ideas" },
    ],
    Settings: {
      "Truncate-result?": 50,
      Folded: true,
    },
  },
};

const queryFilter: QueryFilter = {
  includes: true,
  key: "node-type",
  value: "Claim",
};

const querySettings: QuerySettings = {
  "Hide Query Metadata": true,
  "Default Page Size": 25,
  "Query Pages": ["query-page-uid-1", "query-page-uid-2"],
  "Default Filters": [
    { includes: true, key: "node-type", value: "Claim" },
    { includes: false, key: "status", value: "archived" },
  ],
};

const personalSettings: PersonalSettings = {
  "Left Sidebar": {
    "My Workspace": {
      Children: [
        { Page: "daily-notes-uid", Alias: "Daily Notes" },
        { Page: "inbox-uid", Alias: "Inbox" },
      ],
      Settings: {
        "Truncate-result?": 75,
        Folded: false,
      },
    },
    Research: {
      Children: [
        { Page: "papers-uid", Alias: "Papers" },
        { Page: "notes-uid", Alias: "Notes" },
      ],
      Settings: {
        "Truncate-result?": 50,
        Folded: true,
      },
    },
  },
  "Personal Node Menu Trigger": ";;",
  "Node Search Menu Trigger": "//",
  "Discourse Tool Shortcut": "d",
  "Discourse Context Overlay": true,
  "Suggestive Mode Overlay": true,
  "Overlay in Canvas": false,
  "Text Selection Popup": true,
  "Disable Sidebar Open": false,
  "Page Preview": true,
  "Hide Feedback Button": false,
  "Streamline Styling": true,
  "Auto Canvas Relations": true,
  "Disable Product Diagnostics": false,
  Query: {
    "Hide Query Metadata": true,
    "Default Page Size": 25,
    "Query Pages": ["query-page-uid-1"],
    "Default Filters": [{ includes: true, key: "node-type", value: "Claim" }],
  },
};

const defaultPersonalSettings: PersonalSettings = {
  "Left Sidebar": {},
  "Personal Node Menu Trigger": "",
  "Node Search Menu Trigger": "",
  "Discourse Tool Shortcut": "",
  "Discourse Context Overlay": false,
  "Suggestive Mode Overlay": false,
  "Overlay in Canvas": false,
  "Text Selection Popup": true,
  "Disable Sidebar Open": false,
  "Page Preview": false,
  "Hide Feedback Button": false,
  "Streamline Styling": false,
  "Auto Canvas Relations": false,
  "Disable Product Diagnostics": false,
  Query: {
    "Hide Query Metadata": false,
    "Default Page Size": 10,
    "Query Pages": [],
    "Default Filters": [],
  },
};

const githubSettings: GithubSettings = {
  "oauth-github": "ghp_xxxxxxxxxxxxxxxxxxxx",
  "selected-repo": "username/repository-name",
};

/**
 * Query Block (scratch) Structure Reference
 *
 * The "scratch" block is a child of {{query block}} and contains all query configuration.
 * It has three main children: custom, selections, and conditions.
 *
 * Structure:
 * - scratch
 *   - custom                          // Custom return node configuration
 *     - {custom node text}            // Optional: custom node identifier
 *     - enabled                       // Optional: flag to enable custom node
 *   - selections                      // Column selections for results
 *     - {variable name}               // e.g. "node", "Created Date"
 *       - {label}                     // Optional: display label for column
 *   - conditions                      // Query conditions
 *     - clause | not | or | not or    // Condition type
 *       - source                      // Required for clause/not
 *         - {value}                   // e.g. "node", node type name
 *       - relation                    // Required for clause/not
 *         - {value}                   // e.g. "is a", "has title", "references"
 *       - target                      // Optional for clause/not
 *         - {value}                   // e.g. "Claim", regex pattern
 */

const queryBlockMinimal: RoamBlock = {
  text: "scratch",
  children: [
    { text: "custom" },
    { text: "selections" },
    {
      text: "conditions",
      children: [
        {
          text: "clause",
          children: [
            { text: "source", children: [{ text: "node" }] },
            { text: "relation" },
          ],
        },
      ],
    },
  ],
};

const queryBlockSimple: RoamBlock = {
  text: "scratch",
  children: [
    { text: "custom" },
    { text: "selections" },
    {
      text: "conditions",
      children: [
        {
          text: "clause",
          children: [
            { text: "source", children: [{ text: "node" }] },
            { text: "relation", children: [{ text: "is a" }] },
            { text: "target", children: [{ text: "Claim" }] },
          ],
        },
      ],
    },
  ],
};

const queryBlockWithSelections: RoamBlock = {
  text: "scratch",
  children: [
    { text: "custom" },
    {
      text: "selections",
      children: [
        { text: "node", children: [{ text: "Title" }] },
        { text: "Created Date", children: [{ text: "Created" }] },
        { text: "Author" },
      ],
    },
    {
      text: "conditions",
      children: [
        {
          text: "clause",
          children: [
            { text: "source", children: [{ text: "node" }] },
            { text: "relation", children: [{ text: "is a" }] },
            { text: "target", children: [{ text: "Claim" }] },
          ],
        },
      ],
    },
  ],
};

const queryBlockWithCustom: RoamBlock = {
  text: "scratch",
  children: [
    {
      text: "custom",
      children: [{ text: "myCustomNode" }, { text: "enabled" }],
    },
    { text: "selections" },
    {
      text: "conditions",
      children: [
        {
          text: "clause",
          children: [
            { text: "source", children: [{ text: "node" }] },
            { text: "relation", children: [{ text: "is a" }] },
            { text: "target", children: [{ text: "Evidence" }] },
          ],
        },
      ],
    },
  ],
};

const queryBlockMultipleConditions: RoamBlock = {
  text: "scratch",
  children: [
    { text: "custom" },
    {
      text: "selections",
      children: [
        { text: "node", children: [{ text: "Claim" }] },
        { text: "target", children: [{ text: "Supporting Evidence" }] },
      ],
    },
    {
      text: "conditions",
      children: [
        {
          text: "clause",
          children: [
            { text: "source", children: [{ text: "node" }] },
            { text: "relation", children: [{ text: "is a" }] },
            { text: "target", children: [{ text: "Claim" }] },
          ],
        },
        {
          text: "clause",
          children: [
            { text: "source", children: [{ text: "node" }] },
            { text: "relation", children: [{ text: "Supported By" }] },
            { text: "target", children: [{ text: "target" }] },
          ],
        },
        {
          text: "clause",
          children: [
            { text: "source", children: [{ text: "target" }] },
            { text: "relation", children: [{ text: "is a" }] },
            { text: "target", children: [{ text: "Evidence" }] },
          ],
        },
      ],
    },
  ],
};

const queryBlockWithNot: RoamBlock = {
  text: "scratch",
  children: [
    { text: "custom" },
    { text: "selections" },
    {
      text: "conditions",
      children: [
        {
          text: "clause",
          children: [
            { text: "source", children: [{ text: "node" }] },
            { text: "relation", children: [{ text: "is a" }] },
            { text: "target", children: [{ text: "Claim" }] },
          ],
        },
        {
          text: "not",
          children: [
            { text: "source", children: [{ text: "node" }] },
            { text: "relation", children: [{ text: "has attribute" }] },
            { text: "target", children: [{ text: "Archived" }] },
          ],
        },
      ],
    },
  ],
};

const queryBlockWithOr: RoamBlock = {
  text: "scratch",
  children: [
    { text: "custom" },
    { text: "selections" },
    {
      text: "conditions",
      children: [
        {
          text: "clause",
          children: [
            { text: "source", children: [{ text: "node" }] },
            { text: "relation", children: [{ text: "is a" }] },
            { text: "target", children: [{ text: "Claim" }] },
          ],
        },
        {
          text: "or",
          children: [
            {
              text: "0",
              children: [
                {
                  text: "clause",
                  children: [
                    { text: "source", children: [{ text: "node" }] },
                    { text: "relation", children: [{ text: "has attribute" }] },
                    { text: "target", children: [{ text: "High Priority" }] },
                  ],
                },
              ],
            },
            {
              text: "1",
              children: [
                {
                  text: "clause",
                  children: [
                    { text: "source", children: [{ text: "node" }] },
                    { text: "relation", children: [{ text: "has attribute" }] },
                    { text: "target", children: [{ text: "Urgent" }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const queryBlockWithRegex: RoamBlock = {
  text: "scratch",
  children: [
    { text: "custom" },
    { text: "selections" },
    {
      text: "conditions",
      children: [
        {
          text: "clause",
          children: [
            { text: "source", children: [{ text: "node" }] },
            { text: "relation", children: [{ text: "has title" }] },
            { text: "target", children: [{ text: "/^\\[\\[CLM\\]\\]/" }] },
          ],
        },
      ],
    },
  ],
};
