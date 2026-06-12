import { App, SuggestModal } from "obsidian";
import type { PublishGroupOption } from "~/utils/publishGroupSelection";

type PublishGroupSuggestModalParams = {
  app: App;
  groups: PublishGroupOption[];
  onSelect: (group: PublishGroupOption) => void | Promise<void>;
};

export class PublishGroupSuggestModal extends SuggestModal<PublishGroupOption> {
  private groups: PublishGroupOption[];
  private onSelect: (group: PublishGroupOption) => void | Promise<void>;

  constructor({ app, groups, onSelect }: PublishGroupSuggestModalParams) {
    super(app);
    this.groups = groups;
    this.onSelect = onSelect;
    this.setPlaceholder("Choose a group to share with");
  }

  getItemText(item: PublishGroupOption): string {
    return item.isPublished ? `${item.name} (shared)` : item.name;
  }

  getSuggestions(query: string): PublishGroupOption[] {
    const normalizedQuery = query.toLowerCase();
    return this.groups.filter((group) =>
      group.name.toLowerCase().includes(normalizedQuery),
    );
  }

  renderSuggestion(group: PublishGroupOption, el: HTMLElement): void {
    const row = el.createDiv({ cls: "flex items-center gap-2" });
    row.createSpan({
      cls: "inline-flex w-4 shrink-0 justify-center",
      text: group.isPublished ? "✓" : "",
    });
    row.createSpan({ text: group.name });
  }

  onChooseSuggestion(group: PublishGroupOption): void {
    if (group.isPublished) {
      return;
    }
    void this.onSelect(group);
  }
}
