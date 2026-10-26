import { Modal, Setting, TextAreaComponent } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type { TutorialStep } from "./blocks";
import { requestTutorial } from "./requestTutorial";

const MIN_GOAL_LENGTH = 3;

export class GenerateTutorialModal extends Modal {
  private plugin: DiscourseGraphPlugin;
  private onGenerated: (tutorial: {
    steps: TutorialStep[];
    newToObsidian: boolean;
  }) => void;
  private isClosed = false;

  constructor({
    plugin,
    onGenerated,
  }: {
    plugin: DiscourseGraphPlugin;
    onGenerated: GenerateTutorialModal["onGenerated"];
  }) {
    super(plugin.app);
    this.plugin = plugin;
    this.onGenerated = onGenerated;
  }

  onOpen(): void {
    const { contentEl } = this;
    this.setTitle("Generate a tutorial");
    let goal = "";
    let newToObsidian = true;

    contentEl.createEl("p", {
      text: "Describe what you want to do with your vault, and Discourse Graph will walk you through it step by step.",
      cls: "text-muted",
    });
    const goalInput = new TextAreaComponent(contentEl)
      .setPlaceholder("For example: track claims from the papers I read")
      .onChange((value) => {
        goal = value;
      });
    goalInput.inputEl.rows = 3;
    goalInput.inputEl.addClass("w-full");

    new Setting(contentEl)
      .setName("I'm new to Obsidian")
      .setDesc("Include steps that cover Obsidian basics.")
      .addToggle((toggle) =>
        toggle.setValue(newToObsidian).onChange((value) => {
          newToObsidian = value;
        }),
      );

    const statusEl = contentEl.createDiv({ cls: "text-muted text-sm" });

    new Setting(contentEl).addButton((button) =>
      button
        .setButtonText("Generate")
        .setCta()
        .onClick(async () => {
          if (goal.trim().length < MIN_GOAL_LENGTH) {
            statusEl.setText("Describe your goal in a few words first.");
            return;
          }
          button.setDisabled(true).setButtonText("Generating…");
          statusEl.removeClass("text-error");
          statusEl.setText("This usually takes 10 to 20 seconds.");
          try {
            const { steps } = await requestTutorial({
              plugin: this.plugin,
              goal: goal.trim(),
              newToObsidian,
            });
            // The user may have closed the window while waiting; don't start a tour they abandoned.
            if (this.isClosed) return;
            this.close();
            this.onGenerated({ steps, newToObsidian });
          } catch (error) {
            statusEl.addClass("text-error");
            statusEl.setText(
              `Couldn't generate a tutorial: ${error instanceof Error ? error.message : String(error)}`,
            );
            button.setDisabled(false).setButtonText("Try again");
          }
        }),
    );

    goalInput.inputEl.focus();
  }

  onClose(): void {
    this.isClosed = true;
    this.contentEl.empty();
  }
}
