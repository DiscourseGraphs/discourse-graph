import { StrictMode, useState, useRef, useEffect } from "react";
import { App, PluginSettingTab, setIcon } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { Root, createRoot } from "react-dom/client";
import { ContextProvider } from "./AppContext";
import RelationshipTypeSettings from "./RelationshipTypeSettings";
import RelationshipSettings from "./RelationshipSettings";
import NodeTypeSettings from "./NodeTypeSettings";
import GeneralSettings from "./GeneralSettings";
import { PluginProvider, usePlugin } from "./PluginContext";
import { SLACK_LOGO, WHITE_LOGO_SVG } from "~/icons";

const DOCS_URL = "https://discoursegraphs.com/docs/obsidian";
const COMMUNITY_URL =
  "https://join.slack.com/t/discoursegraphs/shared_invite/zt-37xklatti-cpEjgPQC0YyKYQWPNgAkEg";

const InfoSection = () => {
  const plugin = usePlugin();
  const logoRef = useRef<HTMLDivElement>(null);
  const communityIconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logoRef.current) {
      logoRef.current.innerHTML = WHITE_LOGO_SVG;
    }
    if (communityIconRef.current) {
      communityIconRef.current.innerHTML = SLACK_LOGO;
    }
  }, []);

  return (
    <div className="flex justify-center">
      <div
        className="flex w-48 flex-col items-center rounded-lg p-3"
        style={{ background: "var(--tag-background)" }}
      >
        <div
          ref={logoRef}
          className="h-12 w-12"
          style={{ color: "var(--interactive-accent)" }}
        />
        <div
          className="font-semibold"
          style={{ color: "var(--interactive-accent)" }}
        >
          Discourse Graphs
        </div>

        <a
          href={COMMUNITY_URL}
          className="flex items-center gap-1 text-sm no-underline hover:opacity-80"
          style={{ color: "var(--interactive-accent)" }}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Community"
        >
          <div ref={communityIconRef} className="icon" />
          <span>Community</span>
          <span
            className="icon"
            ref={(el) => (el && setIcon(el, "arrow-up-right")) || undefined}
          />
        </a>
        <a
          href={DOCS_URL}
          className="flex items-center gap-1 text-sm no-underline hover:opacity-80"
          style={{ color: "var(--interactive-accent)" }}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Docs"
        >
          <div
            className="icon"
            ref={(el) => (el && setIcon(el, "book")) || undefined}
          />
          <span>Docs</span>
          <span
            className="icon"
            ref={(el) => (el && setIcon(el, "arrow-up-right")) || undefined}
          />
        </a>
        <span
          className="text-muted text-xs"
          style={{ color: "var(--interactive-accent)" }}
        >
          {plugin.manifest.version}
        </span>
      </div>
    </div>
  );
};

const Settings = () => {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="dg-h2">Discourse Graph Settings</h2>
      <div className="border-modifier-border flex w-full overflow-x-auto border-b p-2">
        <button
          onClick={() => setActiveTab("general")}
          className={`discourse-tab mr-2 cursor-pointer border-0 px-4 py-2 ${
            activeTab === "general"
              ? "!bg-modifier-hover accent-border-bottom"
              : "!bg-transparent"
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab("nodeTypes")}
          className={`discourse-tab mr-2 cursor-pointer border-0 px-4 py-2 ${
            activeTab === "nodeTypes"
              ? "!bg-modifier-hover accent-border-bottom"
              : "!bg-transparent"
          }`}
        >
          Node Types
        </button>
        <button
          onClick={() => setActiveTab("relationTypes")}
          className={`mr-2 cursor-pointer px-4 py-2 ${
            activeTab === "relationTypes"
              ? "!bg-modifier-hover accent-border-bottom"
              : "!bg-transparent"
          }`}
        >
          Relation Types
        </button>
        <button
          onClick={() => setActiveTab("relations")}
          className={`mr-2 cursor-pointer px-4 py-2 ${
            activeTab === "relations"
              ? "!bg-modifier-hover accent-border-bottom"
              : "!bg-transparent"
          }`}
        >
          Discourse Relations
        </button>
      </div>

      {activeTab === "general" && <GeneralSettings />}
      {activeTab === "nodeTypes" && <NodeTypeSettings />}
      {activeTab === "relationTypes" && <RelationshipTypeSettings />}
      {activeTab === "relations" && <RelationshipSettings />}
      {activeTab === "frontmatter" && <GeneralSettings />}

      <InfoSection />
    </div>
  );
};

export class SettingsTab extends PluginSettingTab {
  root: Root | null = null;
  plugin: DiscourseGraphPlugin;

  constructor(app: App, plugin: DiscourseGraphPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const settingsComponentEl = containerEl.createDiv();
    this.root = createRoot(settingsComponentEl);
    this.root.render(
      <StrictMode>
        <ContextProvider app={this.app}>
          <PluginProvider plugin={this.plugin}>
            <Settings />
          </PluginProvider>
        </ContextProvider>
      </StrictMode>,
    );
  }

  hide(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
