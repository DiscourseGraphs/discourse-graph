import { syntaxTree } from "@codemirror/language";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  type PluginValue,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { Editor, MarkdownView, Notice, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { DiscourseNode } from "~/types";
import ModifyNodeModal from "~/components/ModifyNodeModal";
import { addRelationIfRequested } from "~/components/canvas/utils/relationJsonUtils";
import { getNodeTagColors } from "./colorUtils";
import { createDiscourseNodeFile, formatNodeName } from "./createNode";
import {
  extractListPrefix,
  mergeAdjacentRanges,
  tagNameFromSyntaxNode,
  titleFromTaggedLine,
  type TaggedRange,
} from "./discourseTagText";

const HOVER_DELAY = 200;
const HIDE_DELAY = 100;
const TOOLTIP_OFFSET = 40;
const STYLE_ELEMENT_ID = "dg-discourse-tag-colors";
const DISCOURSE_TAG_CLASS = "dg-discourse-tag";
const NODE_ID_ATTR = "data-dg-discourse-tag-node";

type TagStyle = { nodeTypeId: string };
type TagRange = TaggedRange<TagStyle>;

// ============================================================================
// COLOURS
// ============================================================================

/**
 * A mark decoration can only create a span *inside* Obsidian's `.cm-hashtag`,
 * which is the element carrying the tag's padding and border radius, so the
 * colours are applied to that parent through `:has()` on this marker class.
 */
export const discourseTagClassForNode = (nodeTypeId: string): string =>
  `dg-tag-${nodeTypeId.replace(/[^A-Za-z0-9_-]/g, "-")}`;

// Obsidian's own rule is a bare `.cm-hashtag { background: var(--tag-background) }`
// and themes recolour by redefining that variable, so this wins without `!important`.
const buildStyleSheet = (plugin: DiscourseGraphPlugin): string =>
  plugin.settings.nodeTypes
    .map((nodeType, nodeIndex) => {
      if (!nodeType.tag) return null;
      const { backgroundColor, textColor } = getNodeTagColors(
        nodeType,
        nodeIndex,
      );
      return (
        `span.cm-hashtag:has(> .${discourseTagClassForNode(nodeType.id)}) {\n` +
        `  background-color: ${backgroundColor};\n` +
        `  color: ${textColor};\n` +
        `}`
      );
    })
    .filter((rule): rule is string => rule !== null)
    .join("\n\n");

export class DiscourseTagStyleManager {
  constructor(private plugin: DiscourseGraphPlugin) {}

  apply(): void {
    const css = buildStyleSheet(this.plugin);
    this.documents().forEach((doc) => {
      const styleEl =
        doc.getElementById(STYLE_ELEMENT_ID) ??
        doc.head.createEl("style", { attr: { id: STYLE_ELEMENT_ID } });
      styleEl.textContent = css;
    });
  }

  destroy(): void {
    this.documents().forEach((doc) =>
      doc.getElementById(STYLE_ELEMENT_ID)?.remove(),
    );
  }

  // Popout windows have their own document, which the bundled styles.css does not reach.
  private documents(): Document[] {
    const documents = new Set<Document>([document]);
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      const doc = leaf.view.containerEl.ownerDocument;
      if (doc) documents.add(doc);
    });
    return Array.from(documents);
  }
}

// ============================================================================
// DECORATIONS
// ============================================================================

const buildTagStyleIndex = (
  plugin: DiscourseGraphPlugin,
): Map<string, TagStyle> => {
  const index = new Map<string, TagStyle>();
  plugin.settings.nodeTypes.forEach((nodeType) => {
    if (!nodeType.tag) return;
    index.set(nodeType.tag, { nodeTypeId: nodeType.id });
  });
  return index;
};

const tagSettingsSignature = (plugin: DiscourseGraphPlugin): string =>
  plugin.settings.nodeTypes.map((n) => `${n.id}:${n.tag ?? ""}`).join("|");

const collectTaggedRanges = (
  view: EditorView,
  styles: Map<string, TagStyle>,
): TagRange[] => {
  const ranges: TagRange[] = [];

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const tagName = tagNameFromSyntaxNode(node.name);
        if (!tagName) return;
        const style = styles.get(tagName);
        if (!style) return;
        ranges.push({ from: node.from, to: node.to, style });
      },
    });
  }

  return ranges;
};

const buildTagDecorations = (
  view: EditorView,
  plugin: DiscourseGraphPlugin,
): DecorationSet => {
  const styles = buildTagStyleIndex(plugin);
  if (styles.size === 0) return Decoration.none;

  const decorations = mergeAdjacentRanges(
    collectTaggedRanges(view, styles),
  ).map(({ from, to, style }) =>
    Decoration.mark({
      class: `${DISCOURSE_TAG_CLASS} ${discourseTagClassForNode(style.nodeTypeId)}`,
      attributes: { [NODE_ID_ATTR]: style.nodeTypeId },
    }).range(from, to),
  );

  return Decoration.set(decorations);
};

/**
 * CodeMirror rebuilds its content on focus and recreates tag spans as lines
 * scroll through the viewport, silently discarding anything stamped onto them
 * from outside (ENG-2231). Decorations are re-applied on every update.
 */
const createTagDecorationPlugin = (
  plugin: DiscourseGraphPlugin,
): ViewPlugin<PluginValue> =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private settingsSignature: string;

      constructor(view: EditorView) {
        this.settingsSignature = tagSettingsSignature(plugin);
        this.decorations = buildTagDecorations(view, plugin);
      }

      update(update: ViewUpdate): void {
        const signature = tagSettingsSignature(plugin);
        if (
          update.docChanged ||
          update.viewportChanged ||
          signature !== this.settingsSignature
        ) {
          this.settingsSignature = signature;
          this.decorations = buildTagDecorations(update.view, plugin);
        }
      }
    },
    { decorations: (value) => value.decorations },
  );

// ============================================================================
// NODE CREATION
// ============================================================================

type CreateNodeFromTagParams = {
  plugin: DiscourseGraphPlugin;
  nodeType: DiscourseNode;
  title: string;
  editor: Editor;
  lineNumber: number;
  selectedExistingNode?: TFile;
  relationshipId?: string;
  relationshipTargetFile?: TFile;
};

const resolveTargetFile = async ({
  plugin,
  nodeType,
  title,
  selectedExistingNode,
}: Pick<
  CreateNodeFromTagParams,
  "plugin" | "nodeType" | "title" | "selectedExistingNode"
>): Promise<{ file: TFile; linkText: string } | null> => {
  if (selectedExistingNode) {
    return {
      file: selectedExistingNode,
      linkText: `[[${selectedExistingNode.basename}]]`,
    };
  }

  const formattedNodeName = formatNodeName(title, nodeType);
  if (!formattedNodeName) {
    new Notice("Failed to format node name", 3000);
    return null;
  }

  const newFile = await createDiscourseNodeFile({
    plugin,
    formattedNodeName,
    nodeType,
  });
  if (!newFile) {
    new Notice("Failed to create discourse node file", 3000);
    return null;
  }

  return { file: newFile, linkText: `[[${formattedNodeName}]]` };
};

/** Replaces the whole tagged line, preserving any list prefix. */
const createNodeFromTag = async (
  params: CreateNodeFromTagParams,
): Promise<void> => {
  const {
    plugin,
    nodeType,
    title,
    editor,
    lineNumber,
    selectedExistingNode,
    relationshipId,
    relationshipTargetFile,
  } = params;

  try {
    const resolved = await resolveTargetFile({
      plugin,
      nodeType,
      title,
      selectedExistingNode,
    });
    if (!resolved) return;

    if (relationshipId && relationshipTargetFile) {
      await addRelationIfRequested(plugin, resolved.file, {
        relationshipId,
        relationshipTargetFile,
      });
    }

    if (lineNumber < 0 || lineNumber > editor.lastLine()) {
      new Notice("Could not replace tag with discourse node", 3000);
      return;
    }

    const lineText = editor.getLine(lineNumber);
    editor.replaceRange(
      extractListPrefix(lineText) + resolved.linkText,
      { line: lineNumber, ch: 0 },
      { line: lineNumber, ch: lineText.length },
    );
  } catch (error) {
    new Notice(
      `Error creating discourse node: ${
        error instanceof Error ? error.message : String(error)
      }`,
      5000,
    );
  }
};

// ============================================================================
// HOVER TOOLTIP
// ============================================================================

class DiscourseTagHoverController {
  private tooltip: HTMLElement | null = null;
  private showTimeout: number | null = null;
  private hideTimeout: number | null = null;
  private anchor: HTMLElement | null = null;

  constructor(private plugin: DiscourseGraphPlugin) {}

  handleMouseOver(event: MouseEvent, view: EditorView): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const tagEl = target.closest(`.${DISCOURSE_TAG_CLASS}`);
    if (!(tagEl instanceof HTMLElement)) return;
    if (tagEl === this.anchor && this.tooltip) {
      this.cancelHide();
      return;
    }

    const nodeType = this.resolveNodeType(tagEl);
    if (!nodeType) return;

    this.cancelHide();
    this.clearShowTimeout();
    this.showTimeout = window.setTimeout(() => {
      this.show({ tagEl, nodeType, view });
    }, HOVER_DELAY);
  }

  handleMouseOut(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest(`.${DISCOURSE_TAG_CLASS}`)) return;

    const related = event.relatedTarget;
    if (related instanceof Node && this.tooltip?.contains(related)) return;

    this.clearShowTimeout();
    this.scheduleHide();
  }

  destroy(): void {
    this.clearShowTimeout();
    this.cancelHide();
    this.hide();
  }

  private resolveNodeType(tagEl: HTMLElement): DiscourseNode | null {
    const nodeId = tagEl.getAttribute(NODE_ID_ATTR);
    if (!nodeId) return null;
    return (
      this.plugin.settings.nodeTypes.find((node) => node.id === nodeId) ?? null
    );
  }

  // A tag wrapped across two visual lines has several rects; anchor to its start.
  private anchorRect(tagEl: HTMLElement): DOMRect {
    return tagEl.getClientRects().item(0) ?? tagEl.getBoundingClientRect();
  }

  private show({
    tagEl,
    nodeType,
    view,
  }: {
    tagEl: HTMLElement;
    nodeType: DiscourseNode;
    view: EditorView;
  }): void {
    this.hide();

    const rect = this.anchorRect(tagEl);
    const tooltip = createDiv({ cls: "discourse-tag-popover" });
    tooltip.style.top = `${rect.top - TOOLTIP_OFFSET}px`;
    tooltip.style.left = `${rect.left + rect.width / 2}px`;

    const button = tooltip.createEl("button", {
      cls: "mod-cta dg-create-node-button",
      text: `Create ${nodeType.name}`,
    });
    button.addEventListener("click", (clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      this.openModal({ tagEl, nodeType, view });
      this.hide();
    });

    tooltip.addEventListener("mouseenter", () => this.cancelHide());
    tooltip.addEventListener("mouseleave", () => this.scheduleHide());

    activeDocument.body.appendChild(tooltip);
    this.tooltip = tooltip;
    this.anchor = tagEl;
  }

  private openModal({
    tagEl,
    nodeType,
    view,
  }: {
    tagEl: HTMLElement;
    nodeType: DiscourseNode;
    view: EditorView;
  }): void {
    const markdownView =
      this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = markdownView?.editor;
    if (!editor) return;

    // Matching the line by its text resolves to the wrong one when a document repeats it.
    const lineNumber = view.state.doc.lineAt(view.posAtDOM(tagEl)).number - 1;
    const lineText = editor.getLine(lineNumber);

    new ModifyNodeModal(this.plugin.app, {
      nodeTypes: this.plugin.settings.nodeTypes,
      plugin: this.plugin,
      initialTitle: titleFromTaggedLine(lineText),
      initialNodeType: nodeType,
      currentFile: markdownView?.file ?? undefined,
      onSubmit: async ({
        nodeType: selectedNodeType,
        title,
        selectedExistingNode,
        relationshipId,
        relationshipTargetFile,
      }) => {
        await createNodeFromTag({
          plugin: this.plugin,
          nodeType: selectedNodeType,
          title,
          editor,
          lineNumber,
          selectedExistingNode,
          relationshipId,
          relationshipTargetFile,
        });
      },
    }).open();
  }

  private scheduleHide(): void {
    this.cancelHide();
    this.hideTimeout = window.setTimeout(() => this.hide(), HIDE_DELAY);
  }

  private cancelHide(): void {
    if (this.hideTimeout === null) return;
    window.clearTimeout(this.hideTimeout);
    this.hideTimeout = null;
  }

  private clearShowTimeout(): void {
    if (this.showTimeout === null) return;
    window.clearTimeout(this.showTimeout);
    this.showTimeout = null;
  }

  private hide(): void {
    this.tooltip?.remove();
    this.tooltip = null;
    this.anchor = null;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export const createDiscourseTagExtension = (plugin: DiscourseGraphPlugin) => {
  const hover = new DiscourseTagHoverController(plugin);

  return [
    createTagDecorationPlugin(plugin),
    EditorView.domEventHandlers({
      mouseover: (event, view) => {
        hover.handleMouseOver(event, view);
        return false;
      },
      mouseout: (event) => {
        hover.handleMouseOut(event);
        return false;
      },
    }),
  ];
};

// Reconfigures every open editor, which reruns the ViewPlugin's update.
export const refreshDiscourseTagColors = (
  plugin: DiscourseGraphPlugin,
): void => {
  plugin.app.workspace.updateOptions();
};
