import {
  Plugin,
  MarkdownView,
  MarkdownPostProcessorContext,
  Notice,
  MarkdownRenderer,
} from "obsidian";
import { SettingsTab } from "./components/Settings";
import { Settings } from "./types";
import { registerCommands } from "./utils/registerCommands";
import { renderReactComponent } from "./utils/reactRenderer";
import React from "react";
import InteractiveNodeBanner from "./components/InteractiveNodeBanner";

const DEFAULT_SETTINGS: Settings = {
  nodeTypes: [],
  discourseRelations: [],
  relationTypes: [],
};

export default class DiscourseGraphPlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };
  private bannerContainers: WeakMap<HTMLElement, HTMLElement> = new WeakMap();

  async onload() {
    await this.loadSettings();
    registerCommands(this);
    this.addSettingTab(new SettingsTab(this.app, this));

    // Register event for mode changes (switching between edit and preview)
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", async () => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;

        const file = activeView.file;
        if (!file) return;

        const metadata = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (metadata?.nodeTypeId && metadata?.nodeInstanceId) {
          // If we're in edit mode, make sure the banner is injected
          if (activeView.getMode() === "source") {
            this.injectBannerIntoEditor(activeView, metadata);
          }
        }
      }),
    );

    // Also register for editor changes
    // this.registerEvent(
    //   this.app.workspace.on("editor-change", (editor) => {
    //     const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    //     if (!activeView || !activeView.file) return;

    //     const metadata = this.app.metadataCache.getFileCache(
    //       activeView.file,
    //     )?.frontmatter;
    //     if (metadata?.nodeTypeId && metadata?.nodeInstanceId) {
    //       // If in edit mode, update the banner
    //       if (activeView.getMode() === "source") {
    //         this.injectBannerIntoEditor(activeView, metadata);
    //       }
    //     }
    //   }),
    // );

    // Register Markdown post processor to add UI for DiscourseNode files (for READING mode)
    this.registerMarkdownPostProcessor(async (el, ctx) => {
      // Check if this is a DiscourseNode file
      const metadata = ctx.frontmatter;

      // Debug: Log frontmatter detection
      console.log("Processing markdown with frontmatter:", metadata);

      if (!metadata) {
        console.log("No frontmatter detected");
        return;
      }

      if (!metadata.nodeTypeId || !metadata.nodeInstanceId) {
        console.log(
          "Missing required nodeTypeId or nodeInstanceId in frontmatter:",
          metadata,
        );
        return;
      }

      // Debug: Show a notice when we detect a DiscourseNode
      new Notice(
        `DiscourseNode detected in reading mode: ${metadata.nodeTypeId}`,
      );

      // Get the corresponding node type
      const nodeType = this.settings.nodeTypes.find(
        (node) => node.id === metadata.nodeTypeId,
      );

      // Debug: Log available node types
      console.log("Available node types:", this.settings.nodeTypes);
      console.log("Looking for node type:", metadata.nodeTypeId);
      console.log("Found node type:", nodeType);

      if (!nodeType) {
        new Notice(
          `No matching node type found for ID: ${metadata.nodeTypeId}`,
        );
        return;
      }

      // Create container for our React component
      const bannerContainer = el.createDiv({
        cls: "discourse-node-banner-container",
      });

      // Store this container in our map to avoid duplicates
      this.bannerContainers.set(el, bannerContainer);

      // Add distinctive styling to make sure the container is visible
      bannerContainer.setAttribute(
        "style",
        `
        background-color: rgba(255, 0, 0, 0.1); 
        border: 2px solid red; 
        padding: 10px; 
        margin-bottom: 10px;
        min-height: 50px;
      `,
      );

      // Insert the banner at the top of the content
      if (el.firstChild) {
        el.insertBefore(bannerContainer, el.firstChild);
      } else {
        el.appendChild(bannerContainer);
      }

      // Function to handle the "View Relations" button click
      const handleViewRelations = () => {
        // Find all relations for this node
        const nodeId = metadata.nodeInstanceId;
        const relations = this.settings.discourseRelations.filter(
          (relation) =>
            relation.sourceId === nodeId || relation.destinationId === nodeId,
        );

        if (relations.length === 0) {
          new Notice("No relations found for this node");
          return;
        }

        // Display relations in a notice
        new Notice(`Found ${relations.length} relations for this node`);
      };

      // Render our React component inside the container
      try {
        console.log("Attempting to render React component");
        renderReactComponent(
          bannerContainer,
          React.createElement(InteractiveNodeBanner, {
            nodeType,
            metadata,
            onViewRelations: handleViewRelations,
          }),
        );
        console.log("React component rendered successfully");
        new Notice("Banner rendering attempted");
      } catch (error: any) {
        console.error("Error rendering React component:", error);
        new Notice(
          `Error rendering banner: ${error.message || "Unknown error"}`,
        );
      }
    });
  }

  // New method to handle injecting the banner into the editor for edit mode
  private injectBannerIntoEditor(view: MarkdownView, metadata: any) {
    // Only proceed if we're in edit mode
    if (view.getMode() !== "source") return;

    // Find existing banner if any
    const editorEl = view.contentEl.querySelector(".cm-editor");
    if (!editorEl) return;

    // Check if we already have a banner
    let bannerContainer = editorEl.querySelector(
      ".discourse-editor-banner-container",
    ) as HTMLElement;

    // If we don't have a banner container yet, create one
    if (!bannerContainer) {
      bannerContainer = document.createElement("div");
      bannerContainer.className = "discourse-editor-banner-container";
      bannerContainer.setAttribute(
        "style",
        `
        position: sticky;
        top: 0;
        z-index: 10;
        background-color: rgba(255, 0, 0, 0.1); 
        border: 2px solid red; 
        padding: 10px; 
        margin-bottom: 10px;
        min-height: 50px;
      `,
      );

      // Insert at the top of the editor
      editorEl.insertBefore(bannerContainer, editorEl.firstChild);

      // Get the node type
      const nodeType = this.settings.nodeTypes.find(
        (node) => node.id === metadata.nodeTypeId,
      );

      if (!nodeType) {
        bannerContainer.textContent = `No matching node type found for ID: ${metadata.nodeTypeId}`;
        return;
      }

      // Function to handle the "View Relations" button click
      const handleViewRelations = () => {
        // Find all relations for this node
        const nodeId = metadata.nodeInstanceId;
        const relations = this.settings.discourseRelations.filter(
          (relation) =>
            relation.sourceId === nodeId || relation.destinationId === nodeId,
        );

        if (relations.length === 0) {
          new Notice("No relations found for this node");
          return;
        }

        // Display relations in a notice
        new Notice(`Found ${relations.length} relations for this node`);
      };

      // Render our React component inside the container
      try {
        renderReactComponent(
          bannerContainer,
          React.createElement(InteractiveNodeBanner, {
            nodeType,
            metadata,
            onViewRelations: handleViewRelations,
          }),
        );
      } catch (error: any) {
        console.error("Error rendering React component in editor:", error);
        bannerContainer.textContent = `Error rendering banner: ${error.message || "Unknown error"}`;
      }
    }
  }

  onunload() {
    // No need to manually clean up DOM elements as Obsidian does this for us
    // when the plugin is unloaded
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
