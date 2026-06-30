import { App, SuggestModal } from "obsidian";
import type { PublishGroupSuggestItem } from "~/utils/publishGroupSelection";

type PublishGroupSuggestModalParams = {
  app: App;
  items: PublishGroupSuggestItem[];
  onChoose: (item: PublishGroupSuggestItem) => void | Promise<void>;
};

export class PublishGroupSuggestModal extends SuggestModal<PublishGroupSuggestItem> {
  private items: PublishGroupSuggestItem[];
  private onChoose: (item: PublishGroupSuggestItem) => void | Promise<void>;

  constructor({ app, items, onChoose }: PublishGroupSuggestModalParams) {
    super(app);
    this.items = items;
    this.onChoose = onChoose;
    this.setPlaceholder("Choose a group to share with");
  }

  getItemText(item: PublishGroupSuggestItem): string {
    if (item.isPublishToAll) {
      return item.name;
    }
    return item.isPublished ? `${item.name} (shared)` : item.name;
  }

  getSuggestions(query: string): PublishGroupSuggestItem[] {
    const normalizedQuery = query.toLowerCase();
    return this.items.filter((item) =>
      item.name.toLowerCase().includes(normalizedQuery),
    );
  }

  renderSuggestion(item: PublishGroupSuggestItem, el: HTMLElement): void {
    const row = el.createDiv({
      cls: item.isPublishToAll
        ? "border-b border-border pb-1 font-medium"
        : "flex items-center gap-2",
    });

    if (item.isPublishToAll) {
      row.createSpan({ text: item.name });
      return;
    }

    row.createSpan({
      cls: "inline-flex w-4 shrink-0 justify-center",
      text: item.isPublished ? "✓" : "",
    });
    row.createSpan({ text: item.name });
  }

  onChooseSuggestion(item: PublishGroupSuggestItem): void {
    if (item.isPublished) {
      return;
    }
    void this.onChoose(item);
  }
}
