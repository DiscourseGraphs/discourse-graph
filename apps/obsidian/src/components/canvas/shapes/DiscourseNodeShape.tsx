import {
  BaseBoxShapeUtil,
  Editor,
  HTMLContainer,
  resizeBox,
  T,
  TLBaseShape,
  TLResizeInfo,
  TLShapeId,
  useEditor,
  useValue,
  DefaultSizeStyle,
  DefaultFontStyle,
  TLDefaultSizeStyle,
  TLDefaultFontStyle,
  FONT_SIZES,
  FONT_FAMILIES,
  toDomPrecision,
} from "tldraw";
import { App, TFile } from "obsidian";
import { memo, createElement, useEffect } from "react";
import DiscourseGraphPlugin from "~/index";
import {
  getFrontmatterForFile,
  FrontmatterRecord,
  getFirstImageSrcForFile,
} from "./discourseNodeShapeUtils";
import { resolveLinkedFileFromSrc } from "~/components/canvas/stores/assetStore";
import { getNodeTypeById } from "~/utils/typeUtils";
import { calcDiscourseNodeSize } from "~/utils/calcDiscourseNodeSize";
import { openFileInSidebar } from "~/components/canvas/utils/openFileUtils";
import { showToast } from "~/components/canvas/utils/toastUtils";
import ModifyNodeModal from "~/components/ModifyNodeModal";

export type DiscourseNodeShape = TLBaseShape<
  "discourse-node",
  {
    w: number;
    h: number;
    // asset-style source: asset:obsidian.blockref.<id>
    src: string | null;
    // Cached display data
    title: string;
    nodeTypeId: string;
    imageSrc?: string;
    size: TLDefaultSizeStyle;
    fontFamily: TLDefaultFontStyle;
  }
>;

export type DiscourseNodeUtilOptions = {
  app: App;
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
};

/** Default props for new discourse node shapes. Used by getDefaultProps and buildDiscourseNodeShapeRecord. */
export const DEFAULT_DISCOURSE_NODE_PROPS: DiscourseNodeShape["props"] = {
  w: 200,
  h: 100,
  src: null,
  title: "",
  nodeTypeId: "",
  imageSrc: undefined,
  size: "s",
  fontFamily: "sans",
};

export type BuildDiscourseNodeShapeRecordParams = {
  id: TLShapeId;
  x: number;
  y: number;
  props: Partial<DiscourseNodeShape["props"]> &
    Pick<DiscourseNodeShape["props"], "src" | "title" | "nodeTypeId">;
};

/**
 * Build a full DiscourseNodeShape record for editor.createShape.
 * Merges given props with DEFAULT_DISCOURSE_NODE_PROPS.
 */
export const buildDiscourseNodeShapeRecord = (
  editor: Editor,
  { id, x, y, props: propsPartial }: BuildDiscourseNodeShapeRecordParams,
): DiscourseNodeShape => {
  const props: DiscourseNodeShape["props"] = {
    ...DEFAULT_DISCOURSE_NODE_PROPS,
    ...propsPartial,
  };
  return {
    id,
    typeName: "shape",
    type: "discourse-node",
    x,
    y,
    rotation: 0,
    index: editor.getHighestIndexForParent(editor.getCurrentPageId()),
    parentId: editor.getCurrentPageId(),
    isLocked: false,
    opacity: 1,
    meta: {},
    props,
  };
};

export class DiscourseNodeUtil extends BaseBoxShapeUtil<DiscourseNodeShape> {
  static type = "discourse-node" as const;
  declare options: DiscourseNodeUtilOptions;

  static props = {
    w: T.number,
    h: T.number,
    src: T.string.nullable(),
    title: T.string.optional(),
    nodeTypeId: T.string.nullable().optional(),
    imageSrc: T.string.optional(),
    size: DefaultSizeStyle,
    fontFamily: DefaultFontStyle,
  };

  getDefaultProps(): DiscourseNodeShape["props"] {
    return { ...DEFAULT_DISCOURSE_NODE_PROPS };
  }

  override isAspectRatioLocked = () => false;
  override canResize = () => true;

  override onResize(
    shape: DiscourseNodeShape,
    info: TLResizeInfo<DiscourseNodeShape>,
  ) {
    return resizeBox(shape, info);
  }

  override onDoubleClick = (shape: DiscourseNodeShape) => {
    void (async () => {
      const file = await this.getFile(shape, {
        app: this.options.app,
        canvasFile: this.options.canvasFile,
      });

      if (!file) {
        return;
      }

      const fileCache = this.options.app.metadataCache.getFileCache(file);
      const nodeTypeId = fileCache?.frontmatter?.nodeTypeId as
        | string
        | undefined;

      const nodeType = nodeTypeId
        ? this.options.plugin.settings.nodeTypes.find(
            (nt) => nt.id === nodeTypeId,
          )
        : undefined;

      const modal = new ModifyNodeModal(this.options.app, {
        nodeTypes: this.options.plugin.settings.nodeTypes,
        plugin: this.options.plugin,
        onSubmit: async ({ title: newTitle, initialFile: file }) => {
          const editor = this.editor;
          if (!editor || !file) return;

          const formattedName = newTitle.trim();
          if (formattedName) {
            // Rename the file
            const folderPath =
              this.options.plugin.settings.nodesFolderPath.trim();
            let newPath = "";
            if (folderPath) {
              const folderExists =
                this.options.app.vault.getAbstractFileByPath(folderPath);
              if (!folderExists) {
                await this.options.app.vault.createFolder(folderPath);
              }
              newPath = `${folderPath}/${formattedName}.md`;
            } else {
              const dirPath = file.parent?.path ?? "";
              newPath = dirPath
                ? `${dirPath}/${formattedName}.md`
                : `${formattedName}.md`;
            }

            await this.options.app.fileManager.renameFile(file, newPath);

            editor.updateShape<DiscourseNodeShape>({
              id: shape.id,
              type: "discourse-node",
              props: {
                ...shape.props,
                title: formattedName,
              },
            });
          }
        },
        initialFile: file,
        initialNodeType: nodeType,
      });

      modal.open();
    })();
  };

  component(shape: DiscourseNodeShape) {
    return (
      <HTMLContainer>
        {createElement(discourseNodeContent, {
          shape,
          app: this.options.app,
          canvasFile: this.options.canvasFile,
          plugin: this.options.plugin,
        })}
      </HTMLContainer>
    );
  }

  indicator(shape: DiscourseNodeShape) {
    const { bounds } = this.editor.getShapeGeometry(shape);
    return (
      <rect
        width={toDomPrecision(bounds.width)}
        height={toDomPrecision(bounds.height)}
      />
    );
  }

  getFile = async (
    shape: DiscourseNodeShape,
    ctx: { app: App; canvasFile: TFile },
  ): Promise<TFile | null> => {
    const app = ctx?.app ?? this.options.app;
    const canvasFile = ctx?.canvasFile ?? this.options.canvasFile;
    return resolveLinkedFileFromSrc({
      app,
      canvasFile,
      src: shape.props.src ?? undefined,
    });
  };

  getFrontmatter = async (
    shape: DiscourseNodeShape,
    ctx: { app: App; canvasFile: TFile },
  ): Promise<FrontmatterRecord | null> => {
    const app = ctx?.app ?? this.options.app;
    const file = await this.getFile(shape, ctx);
    if (!file) return null;
    return getFrontmatterForFile(app, file);
  };

  getRelations = async (
    shape: DiscourseNodeShape,
    ctx: { app: App; canvasFile: TFile },
  ): Promise<unknown[]> => {
    const frontmatter = await this.getFrontmatter(shape, ctx);
    if (!frontmatter) return [];
    // TODO: derive relations from frontmatter
    return [];
  };
}

const discourseNodeContent = memo(
  ({
    shape,
    app,
    canvasFile,
    plugin,
  }: {
    shape: DiscourseNodeShape;
    app: App;
    canvasFile: TFile;
    plugin: DiscourseGraphPlugin;
  }) => {
    const editor = useEditor();
    const { src, title, nodeTypeId } = shape.props;
    const nodeType = getNodeTypeById(plugin, nodeTypeId);

    const isHovered = useValue(
      "is hovered",
      () => {
        return editor.getHoveredShapeId() === shape.id;
      },
      [editor, shape.id],
    );

    useEffect(() => {
      const loadNodeData = async () => {
        if (!src) {
          editor.updateShape<DiscourseNodeShape>({
            id: shape.id,
            type: "discourse-node",
            props: {
              ...shape.props,
              title: "(no source)",
            },
          });
          return;
        }

        try {
          const linkedFile = await resolveLinkedFileFromSrc({
            app,
            canvasFile,
            src,
          });

          if (!linkedFile) {
            return;
          }

          if (linkedFile.basename !== shape.props.title) {
            editor.updateShape<DiscourseNodeShape>({
              id: shape.id,
              type: "discourse-node",
              props: {
                ...shape.props,
                title: linkedFile.basename,
              },
            });
          }

          let currentImageSrc = shape.props.imageSrc;
          if (nodeType?.keyImage) {
            const imageSrc = await getFirstImageSrcForFile(app, linkedFile);

            if (imageSrc && imageSrc !== shape.props.imageSrc) {
              currentImageSrc = imageSrc;
              editor.updateShape<DiscourseNodeShape>({
                id: shape.id,
                type: "discourse-node",
                props: {
                  ...shape.props,
                  imageSrc,
                },
              });
            }
          } else if (shape.props.imageSrc) {
            currentImageSrc = undefined;
            editor.updateShape<DiscourseNodeShape>({
              id: shape.id,
              type: "discourse-node",
              props: {
                ...shape.props,
                imageSrc: undefined,
              },
            });
          }

          // Recalculate size when title, image, font size, or font family changes
          const { w, h } = await calcDiscourseNodeSize({
            title: linkedFile.basename,
            nodeTypeId: shape.props.nodeTypeId,
            imageSrc: currentImageSrc,
            plugin,
            size: shape.props.size ?? "s",
            fontFamily: shape.props.fontFamily ?? "draw",
          });
          // Only update dimensions if they differ significantly (>1px)
          if (
            Math.abs((shape.props.w || 0) - w) > 1 ||
            Math.abs((shape.props.h || 0) - h) > 1
          ) {
            editor.updateShape<DiscourseNodeShape>({
              id: shape.id,
              type: "discourse-node",
              props: {
                ...shape.props,
                w,
                h,
              },
            });
          }
        } catch (error) {
          console.error("Error loading node data", error);
          return;
        }
      };

      void loadNodeData();

      return () => {
        return;
      };
      // Trigger when content changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      src,
      shape.id,
      shape.props.title,
      shape.props.nodeTypeId,
      shape.props.imageSrc,
      editor,
      app,
      canvasFile,
      plugin,
      nodeType?.keyImage,
    ]);

    const handleOpenInSidebar = async (): Promise<void> => {
      if (!src) {
        showToast({
          severity: "warning",
          title: "Cannot open node",
          description: "No source file linked",
        });
        return;
      }
      try {
        const linkedFile = await resolveLinkedFileFromSrc({
          app,
          canvasFile,
          src,
        });

        if (!linkedFile) {
          showToast({
            severity: "warning",
            title: "Cannot open node",
            description: "Linked file not found",
          });
          return;
        }

        await openFileInSidebar(app, linkedFile);
        editor.selectNone();
      } catch (error) {
        console.error("Error opening linked file:", error);
        showToast({
          severity: "error",
          title: "Error",
          description: "Failed to open linked file",
        });
      }
    };
    const fontSize = FONT_SIZES[shape.props.size];
    const fontFamily = FONT_FAMILIES[shape.props.fontFamily];

    return (
      <div
        style={{
          backgroundColor: nodeType?.color ?? "",
        }}
        // NOTE: These Tailwind classes (p-2, border-2, rounded-md, m-1, text-base, m-0, text-sm)
        // correspond to constants in nodeConstants.ts. If you change these classes, update the
        // constants and the measureNodeText function to keep measurements accurate.
        className="relative box-border flex h-full w-full flex-col items-start justify-center overflow-hidden rounded-md border-2 p-2"
      >
        {isHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleOpenInSidebar();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
            }}
            className="absolute left-1 top-1 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-black/10 bg-white/90 p-1 shadow-sm transition-all duration-200 hover:bg-white"
            style={{
              pointerEvents: "auto",
            }}
            title="Open in sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
          </button>
        )}

        {shape.props.imageSrc ? (
          <div className="mt-2 flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
            <img
              src={shape.props.imageSrc}
              loading="lazy"
              decoding="async"
              draggable="false"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : null}
        <h1
          className="m-1"
          style={{
            fontSize: `${fontSize}px`,
            fontFamily,
          }}
        >
          {title || "..."}
        </h1>
      </div>
    );
  },
);

discourseNodeContent.displayName = "DiscourseNodeContent";

export const createDiscourseNodeUtil = (options: DiscourseNodeUtilOptions) => {
  const configuredUtil = class extends DiscourseNodeUtil {
    options = options;
  };
  return configuredUtil;
};
