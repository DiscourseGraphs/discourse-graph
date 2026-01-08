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
  StoredFilters,
  QuerySettings,
  PersonalSettings,
  GithubSettings,
  QueryCondition,
  QuerySelection,
  RoamNodeType,
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
    { text: "Summary::", heading: 2 },
    { text: "Key Points::", heading: 2, children: [{ text: "" }] },
  ],
  embeddingRef: "((block-uid-123))",
  isFirstChild: {
    uid: "first-child-uid",
    value: true,
  },
};

const discourseNodeSettings: DiscourseNodeSettings = {
  text: "Claim",
  uid: "_CLM-node",
  format: "[[CLM]] - {content}",
  shortcut: "C",
  tag: "#claim",
  description: "A statement or assertion that can be supported or refuted",
  specification: [
    {
      uid: "spec-uid-1",
      type: "clause",
      source: "Claim",
      relation: "has title",
      target: "/^\\[\\[CLM\\]\\]/",
    },
  ],
  template: [
    { text: "Summary::", heading: 2 },
    { text: "Evidence::", heading: 2, children: [{ text: "" }] },
    { text: "Counterarguments::", heading: 2, children: [{ text: "" }] },
  ],
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
  suggestiveRules: {
    template: [],
    embeddingRef: "((embed-ref))",
    isFirstChild: {
      uid: "is-first-child-uid",
      value: false,
    },
  },
  embeddingRef: "((main-embed-ref))",
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

const suggestiveModeGlobalSettings: SuggestiveModeGlobalSettings = {
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

const storedFilters: StoredFilters = {
  includes: { values: ["Claim", "Evidence"] },
  excludes: { values: ["archived"] },
};

const querySettings: QuerySettings = {
  "Hide Query Metadata": true,
  "Default Page Size": 25,
  "Query Pages": ["query-page-uid-1", "query-page-uid-2"],
  "Default Filters": {
    "node-type": {
      includes: { values: ["Claim"] },
      excludes: { values: [] },
    },
    status: {
      includes: { values: [] },
      excludes: { values: ["archived"] },
    },
  },
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
    "Default Filters": {
      "node-type": {
        includes: { values: ["Claim"] },
        excludes: { values: [] },
      },
    },
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
    "Default Filters": {},
  },
};

const githubSettings: GithubSettings = {
  "oauth-github": "ghp_xxxxxxxxxxxxxxxxxxxx",
  "selected-repo": "username/repository-name",
};

const clauseCondition: QueryCondition = {
  uid: "clause-uid-1",
  type: "clause",
  source: "node",
  relation: "is a",
  target: "Claim",
};

const notCondition: QueryCondition = {
  uid: "not-uid-1",
  type: "not",
  source: "node",
  relation: "has attribute",
  target: "Archived",
};

const orCondition: QueryCondition = {
  uid: "or-uid-1",
  type: "or",
  conditions: [
    [
      {
        uid: "clause-uid-2",
        type: "clause",
        source: "node",
        relation: "has attribute",
        target: "High Priority",
      },
    ],
    [
      {
        uid: "clause-uid-3",
        type: "clause",
        source: "node",
        relation: "has attribute",
        target: "Urgent",
      },
    ],
  ],
};

const norCondition: QueryCondition = {
  uid: "nor-uid-1",
  type: "not or",
  conditions: [
    [
      {
        uid: "clause-uid-4",
        type: "clause",
        source: "node",
        relation: "is a",
        target: "Draft",
      },
    ],
    [
      {
        uid: "clause-uid-5",
        type: "clause",
        source: "node",
        relation: "is a",
        target: "Archived",
      },
    ],
  ],
};

const exampleConditions: QueryCondition[] = [
  clauseCondition,
  notCondition,
  orCondition,
  norCondition,
];

const titleSelection: QuerySelection = {
  uid: "sel-uid-1",
  text: "node",
  label: "Title",
};

const dateSelection: QuerySelection = {
  uid: "sel-uid-2",
  text: "Created Date",
  label: "Created",
};

const exampleSelections: QuerySelection[] = [titleSelection, dateSelection];

const simpleNode: RoamNodeType = {
  text: "A simple block",
};

const nodeWithHeading: RoamNodeType = {
  text: "Section Title",
  heading: 1,
};

const nodeWithChildren: RoamNodeType = {
  text: "Steps:",
  children: [
    { text: "First step" },
    { text: "Second step" },
    { text: "Third step" },
  ],
};

const fullTemplateExample: RoamNodeType[] = [
  { text: "Meeting Notes", heading: 1 },
  { text: "Attendees::" },
  { text: "Agenda::", heading: 2, children: [{ text: "" }] },
  { text: "Discussion::", heading: 2 },
  { text: "Action Items::", heading: 2, children: [{ text: "" }] },
];
