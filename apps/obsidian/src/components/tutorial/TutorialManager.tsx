import { Scope } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { PluginProvider } from "~/components/PluginContext";
import type DiscourseGraphPlugin from "~/index";
import type { TourStep } from "./tourSteps";
import { TutorialOverlay } from "./TutorialOverlay";

export class TutorialManager {
  private plugin: DiscourseGraphPlugin;
  private root: Root | null = null;
  private container: HTMLDivElement | null = null;
  private scope: Scope | null = null;

  constructor(plugin: DiscourseGraphPlugin) {
    this.plugin = plugin;
  }

  start({
    steps,
    includeBasics,
  }: {
    steps: TourStep[];
    includeBasics: boolean;
  }): void {
    this.stop();

    // A keymap scope, not a document listener: an open modal or the command palette
    // pushes its own scope on top, so Escape closes that first instead of ending the tour.
    this.scope = new Scope(this.plugin.app.scope);
    this.scope.register([], "Escape", () => {
      this.stop();
      return false;
    });
    this.plugin.app.keymap.pushScope(this.scope);

    this.container = activeDocument.body.createDiv();
    const root = createRoot(this.container);
    this.root = root;
    // The overlay closes from inside its own effects; React can't unmount a root mid-render.
    const close = (): void =>
      queueMicrotask(() => {
        if (this.root === root) this.stop();
      });
    root.render(
      <PluginProvider plugin={this.plugin}>
        <TutorialOverlay
          steps={steps}
          includeBasics={includeBasics}
          onClose={close}
        />
      </PluginProvider>,
    );
  }

  stop(): void {
    if (this.scope) {
      this.plugin.app.keymap.popScope(this.scope);
      this.scope = null;
    }
    this.root?.unmount();
    this.root = null;
    this.container?.remove();
    this.container = null;
  }
}
