"use client";

import {
  Check,
  ChevronDown,
  CircleHelp,
  FileDown,
  GitBranch,
  Link2,
  Plus,
  Share2,
  X,
} from "lucide-react";
import Link from "next/link";
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { useSync } from "@tldraw/sync";
import {
  Tldraw,
  createShapeId,
  type Editor,
  type TLArrowShape,
  type TLAssetStore,
  type TLShapeId,
  type TLGeoShape,
  type TLShape,
  useEditor,
  useValue,
} from "tldraw";
import {
  formatCanvasExport,
  NODE_TYPES,
  type CanvasExport,
  type ExportTarget,
  type NodeType,
} from "../lib/exportCanvas";

const SYNC_SERVER_URL =
  process.env.NEXT_PUBLIC_TLDRAW_SYNC_URL ??
  "https://multiplayer-dg-sync.discoursegraphs.workers.dev";

const NODE_CONFIG: Record<
  NodeType,
  { color: "green" | "red" | "yellow"; label: string; prompt: string }
> = {
  claim: {
    color: "green",
    label: "Claim",
    prompt: "State a claim...",
  },
  evidence: {
    color: "red",
    label: "Evidence",
    prompt: "Add evidence...",
  },
  question: {
    color: "yellow",
    label: "Question",
    prompt: "Ask a question...",
  },
};

const RELATION_TYPES = ["Supports", "Opposes", "Informs"] as const;
const COLLABORATOR_NAMES = [
  "Curious Otter",
  "Careful Raven",
  "Bright Finch",
  "Patient Fox",
  "Bold Heron",
  "Quiet Badger",
] as const;

const getCollaborator = (): { id: string; name: string } => {
  const storageKey = "dg-canvas-collaborator";
  const stored = sessionStorage.getItem(storageKey);
  if (stored) {
    try {
      return JSON.parse(stored) as { id: string; name: string };
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }

  const id = crypto.randomUUID();
  const name =
    COLLABORATOR_NAMES[Math.floor(Math.random() * COLLABORATOR_NAMES.length)] ??
    "Canvas guest";
  const collaborator = { id, name };
  sessionStorage.setItem(storageKey, JSON.stringify(collaborator));
  return collaborator;
};

const getNodeType = (shape: TLShape): NodeType | null => {
  const candidate = shape.meta?.dgType;
  return NODE_TYPES.includes(candidate as NodeType)
    ? (candidate as NodeType)
    : null;
};

const getBoundShapeId = (endpoint: unknown): TLShapeId | null => {
  if (!endpoint || typeof endpoint !== "object") return null;
  const candidate = (endpoint as { boundShapeId?: unknown }).boundShapeId;
  return typeof candidate === "string" ? (candidate as TLShapeId) : null;
};

const getCanvasExport = ({ editor }: { editor: Editor }): CanvasExport => {
  const shapes = editor.getCurrentPageShapes();
  const nodes = shapes
    .flatMap((shape) => {
      const type = getNodeType(shape);
      if (!type || shape.type !== "geo") return [];
      const geoShape = shape as TLGeoShape;
      return [
        {
          id: shape.id,
          text: geoShape.props.text,
          type,
          x: shape.x,
          y: shape.y,
        },
      ];
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const relations = shapes.flatMap((shape) => {
    if (shape.type !== "arrow") return [];
    const arrow = shape as TLArrowShape;
    const fromId = getBoundShapeId(arrow.props.start);
    const toId = getBoundShapeId(arrow.props.end);
    if (!fromId || !toId || !nodeIds.has(fromId) || !nodeIds.has(toId)) {
      return [];
    }
    return [
      {
        fromId,
        label: arrow.props.text || "Relates to",
        toId,
      },
    ];
  });

  return {
    nodes: nodes.map(({ id, text, type }) => ({ id, text, type })),
    relations,
  };
};

const createNode = ({
  editor,
  type,
}: {
  editor: Editor;
  type: NodeType;
}): void => {
  const bounds = editor.getViewportPageBounds();
  const existingNodes = editor
    .getCurrentPageShapes()
    .filter((shape) => getNodeType(shape));
  const offset = (existingNodes.length % 5) * 22;
  const id = createShapeId();
  const config = NODE_CONFIG[type];

  editor.createShape<TLGeoShape>({
    id,
    type: "geo",
    x: bounds.x + bounds.w / 2 - 130 + offset,
    y: bounds.y + bounds.h / 2 - 58 + offset,
    meta: { dgType: type },
    props: {
      align: "start",
      color: config.color,
      fill: "solid",
      font: "sans",
      geo: "rectangle",
      h: 116,
      size: "m",
      text: config.prompt,
      verticalAlign: "middle",
      w: 260,
    },
  });
  editor.select(id);
  editor.setEditingShape(id);
};

const CanvasHeader = ({ roomId }: { roomId: string }): ReactElement => {
  const [copied, setCopied] = useState(false);

  const copyRoomLink = async (): Promise<void> => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 shadow-sm sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-sm font-semibold text-slate-900 no-underline"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-slate-900 text-[11px] font-bold tracking-tight text-white">
            DG
          </span>
          <span className="hidden sm:inline">Discourse canvas</span>
        </Link>
        <span className="hidden h-5 w-px bg-slate-200 sm:block" />
        <span className="truncate text-xs text-slate-500">
          Room {roomId.slice(0, 8)}
        </span>
        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 sm:inline-flex">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* A hard navigation requests a fresh server-generated room every time. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/canvas/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 no-underline shadow-sm transition-colors hover:bg-slate-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">New</span>
        </a>
        <button
          type="button"
          onClick={() => void copyRoomLink()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-700"
        >
          {copied ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Share2 className="size-4" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Share"}
        </button>
      </div>
    </header>
  );
};

type ExportDialogProps = {
  canvas: CanvasExport;
  onClose: () => void;
};

const ExportDialog = ({ canvas, onClose }: ExportDialogProps): ReactElement => {
  const [target, setTarget] = useState<ExportTarget>("roam");
  const [copied, setCopied] = useState(false);
  const output = formatCanvasExport({ canvas, target });

  const copyExport = async (): Promise<void> => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[999] grid place-items-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="canvas-export-title"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-6 border-b border-slate-200 px-5 py-4">
          <div>
            <h2
              id="canvas-export-title"
              className="text-base font-semibold text-slate-900"
            >
              Copy your discourse graph
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Paste as editable outline text. This prototype does not sync back.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close export"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-1">
            {(["roam", "obsidian"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTarget(option)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  target === option
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <textarea
            readOnly
            value={output || "Add a node to the canvas, then export again."}
            className="h-64 w-full resize-none rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100 outline-none"
            aria-label={`${target} export`}
          />
          <button
            type="button"
            onClick={() => void copyExport()}
            disabled={!output}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copied ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <FileDown className="size-4" aria-hidden="true" />
            )}
            {copied ? "Copied to clipboard" : `Copy for ${target}`}
          </button>
        </div>
      </div>
    </div>
  );
};

const NodeButton = ({
  onClick,
  type,
}: {
  onClick: () => void;
  type: NodeType;
}): ReactElement => {
  const config = NODE_CONFIG[type];
  const accentClasses: Record<NodeType, string> = {
    claim: "bg-[#7DA13E]",
    evidence: "bg-[#DB134A]",
    question: "bg-[#B7A51C]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 max-sm:w-auto"
    >
      <span className={`size-3 rounded-[4px] ${accentClasses[type]}`} />
      {config.label}
      <Plus
        className="ml-auto size-3.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 max-sm:hidden"
        aria-hidden="true"
      />
    </button>
  );
};

const CanvasChrome = (): ReactElement => {
  const editor = useEditor();
  const pendingRelation = useRef<string | null>(null);
  const [isRelationMenuOpen, setIsRelationMenuOpen] = useState(false);
  const [exportCanvas, setExportCanvas] = useState<CanvasExport | null>(null);
  const shapeCount = useValue(
    "discourse shape count",
    () =>
      editor.getCurrentPageShapes().filter((shape) => getNodeType(shape))
        .length,
    [editor],
  );

  useEffect(
    () =>
      editor.sideEffects.registerAfterCreateHandler("shape", (shape) => {
        if (shape.type !== "arrow" || !pendingRelation.current) return;
        editor.updateShape<TLArrowShape>({
          id: shape.id,
          type: "arrow",
          props: { text: pendingRelation.current },
        });
        pendingRelation.current = null;
      }),
    [editor],
  );

  const startRelation = (label: string): void => {
    pendingRelation.current = label;
    setIsRelationMenuOpen(false);
    editor.setCurrentTool("arrow");
  };

  return (
    <>
      <div className="pointer-events-auto absolute left-3 top-3 z-20 w-40 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur max-sm:bottom-16 max-sm:left-1/2 max-sm:top-auto max-sm:flex max-sm:w-auto max-sm:-translate-x-1/2 max-sm:items-center max-sm:gap-1">
        <p className="px-2 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 max-sm:hidden">
          Add node
        </p>
        {NODE_TYPES.map((type) => (
          <NodeButton
            key={type}
            type={type}
            onClick={() => createNode({ editor, type })}
          />
        ))}
        <div className="my-1 h-px bg-slate-200 max-sm:mx-1 max-sm:h-7 max-sm:w-px" />
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsRelationMenuOpen((isOpen) => !isOpen)}
            className="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 max-sm:w-auto"
          >
            <GitBranch className="size-4 text-slate-500" aria-hidden="true" />
            Relation
            <ChevronDown
              className="ml-auto size-3.5 text-slate-400 max-sm:hidden"
              aria-hidden="true"
            />
          </button>
          {isRelationMenuOpen && (
            <div className="absolute left-full top-0 ml-2 w-32 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl max-sm:bottom-full max-sm:left-auto max-sm:right-0 max-sm:top-auto max-sm:mb-2 max-sm:ml-0">
              {RELATION_TYPES.map((relation) => (
                <button
                  key={relation}
                  type="button"
                  onClick={() => startRelation(relation)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  {relation}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExportCanvas(getCanvasExport({ editor }))}
          className="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 max-sm:w-auto"
        >
          <FileDown className="size-4 text-slate-500" aria-hidden="true" />
          Export
        </button>
      </div>

      {shapeCount === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-6">
          <div className="pointer-events-auto mb-14 max-w-sm rounded-2xl border border-slate-200 bg-white/95 p-6 text-center shadow-xl backdrop-blur">
            <div className="mx-auto grid size-10 place-items-center rounded-xl bg-slate-900 text-white">
              <CircleHelp className="size-5" aria-hidden="true" />
            </div>
            <h1 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
              Map an idea together
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Start with a question, then connect claims and evidence. Anyone
              with this link can edit live.
            </p>
            <button
              type="button"
              onClick={() => createNode({ editor, type: "question" })}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add the first question
            </button>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden items-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-[11px] text-slate-500 shadow-sm backdrop-blur md:flex">
        <Link2 className="size-3.5" aria-hidden="true" />
        Share the link to collaborate
      </div>

      {exportCanvas && (
        <ExportDialog
          canvas={exportCanvas}
          onClose={() => setExportCanvas(null)}
        />
      )}
    </>
  );
};

export const CanvasRoom = ({ roomId }: { roomId: string }): ReactElement => {
  const [collaborator] = useState(getCollaborator);
  const assets = useMemo<TLAssetStore>(
    () => ({
      resolve: (asset) => asset.props.src,
      upload: () =>
        Promise.reject(
          new Error("File uploads are not supported in this prototype."),
        ),
    }),
    [],
  );
  const uri = useMemo(
    () => `${SYNC_SERVER_URL}/connect/web-${roomId}`,
    [roomId],
  );
  const store = useSync({
    assets,
    uri,
    userInfo: collaborator,
  });
  const components = useMemo(
    () => ({
      InFrontOfTheCanvas: CanvasChrome,
      SharePanel: () => null,
    }),
    [],
  );

  return (
    <main className="flex h-dvh flex-col bg-slate-100 text-slate-900">
      <CanvasHeader roomId={roomId} />
      <div className="relative min-h-0 flex-1">
        <Tldraw
          autoFocus
          components={components}
          initialState="select"
          store={store}
        />
      </div>
    </main>
  );
};
