import { createRoot, Root } from "react-dom/client";
import React from "react";
import { OnboardingTour } from "./OnboardingTour";
import { PluginProvider } from "~/components/PluginContext";
import type DiscourseGraphPlugin from "~/index";

export class OnboardingTourManager {
  private root: Root | null = null;
  private container: HTMLDivElement | null = null;
  private plugin: DiscourseGraphPlugin;

  constructor(plugin: DiscourseGraphPlugin) {
    this.plugin = plugin;
  }

  start() {
    if (this.root) return; // Prevent double-start

    this.container = document.createElement("div");
    this.container.id = "discourse-graph-onboarding-tour";
    document.body.appendChild(this.container);

    this.root = createRoot(this.container);
    this.root.render(
      React.createElement(
        PluginProvider,
        { plugin: this.plugin },
        React.createElement(OnboardingTour, {
          onComplete: () => this.stop(),
        }),
      ),
    );
  }

  stop() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
