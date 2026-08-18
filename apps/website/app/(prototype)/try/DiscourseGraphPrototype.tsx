"use client";

import { useMemo, useState, type ChangeEvent, type ReactElement } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  FileSearch,
  FlaskConical,
  Link2,
  Network,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Unlink,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  NODE_TYPES,
  RELATIONSHIP_TYPES,
  addRelationship,
  deleteNode,
  getSeedNodes,
  removeRelationship,
  type DiscourseLink,
  type DiscourseNode,
  type NodeType,
  type RelationshipType,
} from "./model";

type NodeTypeConfig = {
  border: string;
  color: string;
  icon: LucideIcon;
  label: string;
  surface: string;
};

const NODE_TYPE_CONFIG: Record<NodeType, NodeTypeConfig> = {
  question: {
    label: "Question",
    icon: CircleHelp,
    color: "text-violet-700",
    surface: "bg-violet-50",
    border: "border-violet-200",
  },
  claim: {
    label: "Claim",
    icon: Check,
    color: "text-orange-700",
    surface: "bg-orange-50",
    border: "border-orange-200",
  },
  evidence: {
    label: "Evidence",
    icon: FlaskConical,
    color: "text-emerald-700",
    surface: "bg-emerald-50",
    border: "border-emerald-200",
  },
  source: {
    label: "Source",
    icon: BookOpen,
    color: "text-sky-700",
    surface: "bg-sky-50",
    border: "border-sky-200",
  },
};

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  supports: "supports",
  challenges: "challenges",
  cites: "cites",
  relates_to: "relates to",
};

type TypeBadgeProps = {
  compact?: boolean;
  type: NodeType;
};

const TypeBadge = ({ compact = false, type }: TypeBadgeProps): ReactElement => {
  const config = NODE_TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border font-medium ${config.border} ${config.color} ${config.surface} ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
      }`}
    >
      <Icon
        className={compact ? "h-2.5 w-2.5" : "h-3 w-3"}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
};

type OutlineNodeProps = {
  depth: number;
  expandedIds: Set<string>;
  forceExpanded: boolean;
  node: DiscourseNode;
  nodes: DiscourseNode[];
  onSelect: (nodeId: string) => void;
  onToggle: (nodeId: string) => void;
  selectedId: string;
  visibleIds: Set<string>;
};

const OutlineNode = ({
  depth,
  expandedIds,
  forceExpanded,
  node,
  nodes,
  onSelect,
  onToggle,
  selectedId,
  visibleIds,
}: OutlineNodeProps): ReactElement => {
  const children = nodes.filter(
    (candidate) =>
      candidate.parentId === node.id && visibleIds.has(candidate.id),
  );
  const isExpanded = forceExpanded || expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <li>
      <div
        className={`group flex min-h-12 items-start gap-1 border-l-2 py-1.5 pr-2 transition-colors ${
          isSelected
            ? "border-primary bg-orange-50/70"
            : "border-transparent hover:bg-stone-50"
        }`}
        style={{ paddingLeft: `${Math.min(depth, 6) * 20 + 8}px` }}
      >
        <button
          type="button"
          className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-700 ${
            children.length === 0 ? "invisible" : ""
          }`}
          onClick={() => onToggle(node.id)}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.text}`}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          className="min-w-0 flex-1 rounded px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          onClick={() => onSelect(node.id)}
        >
          <span className="flex flex-wrap items-center gap-2">
            <TypeBadge compact type={node.type} />
            <span className="min-w-0 text-sm leading-6 text-stone-800">
              {node.text}
            </span>
          </span>
          {node.links.length > 0 && (
            <span
              className="mt-1 flex flex-wrap gap-1.5"
              aria-label="Relationships"
            >
              {node.links.slice(0, 2).map((link) => {
                const target = nodes.find(
                  (candidate) => candidate.id === link.targetId,
                );
                if (!target) return null;

                return (
                  <span
                    key={`${link.type}-${link.targetId}`}
                    className="inline-flex max-w-full items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500"
                  >
                    <Link2 className="h-2.5 w-2.5" aria-hidden="true" />
                    {RELATIONSHIP_LABELS[link.type]} ·{" "}
                    {target.text.slice(0, 34)}
                    {target.text.length > 34 ? "…" : ""}
                  </span>
                );
              })}
            </span>
          )}
        </button>
      </div>

      {children.length > 0 && isExpanded && (
        <ul>
          {children.map((child) => (
            <OutlineNode
              key={child.id}
              node={child}
              nodes={nodes}
              depth={depth + 1}
              expandedIds={expandedIds}
              forceExpanded={forceExpanded}
              onSelect={onSelect}
              onToggle={onToggle}
              selectedId={selectedId}
              visibleIds={visibleIds}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

type ConnectionRowProps = {
  direction: "incoming" | "outgoing";
  link: DiscourseLink;
  node: DiscourseNode;
  onRemove?: () => void;
  onSelect: (nodeId: string) => void;
};

const ConnectionRow = ({
  direction,
  link,
  node,
  onRemove,
  onSelect,
}: ConnectionRowProps): ReactElement => (
  <div className="group flex items-start gap-2 rounded-lg border border-stone-200 bg-white p-2.5">
    <button
      type="button"
      className="min-w-0 flex-1 text-left"
      onClick={() => onSelect(node.id)}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-stone-400">
        {direction === "incoming"
          ? "Referenced by"
          : RELATIONSHIP_LABELS[link.type]}
        {direction === "incoming" && (
          <span className="normal-case tracking-normal text-stone-500">
            · {RELATIONSHIP_LABELS[link.type]}
          </span>
        )}
      </span>
      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-stone-700">
        {node.text}
      </span>
    </button>
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="mt-0.5 rounded p-1 text-stone-300 opacity-0 transition hover:bg-stone-100 hover:text-stone-600 focus:opacity-100 group-hover:opacity-100"
        aria-label={`Remove relationship to ${node.text}`}
      >
        <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    )}
  </div>
);

type NodeComposerProps = {
  nodes: DiscourseNode[];
  onClose: () => void;
  onCreate: ({
    parentId,
    text,
    type,
  }: {
    parentId: string | null;
    text: string;
    type: NodeType;
  }) => void;
  suggestedParentId: string | null;
};

const NodeComposer = ({
  nodes,
  onClose,
  onCreate,
  suggestedParentId,
}: NodeComposerProps): ReactElement => {
  const [text, setText] = useState("");
  const [type, setType] = useState<NodeType>("claim");
  const [parentId, setParentId] = useState<string | null>(suggestedParentId);

  const handleSubmit = (): void => {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    onCreate({ parentId, text: trimmedText, type });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/25 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-node-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl shadow-stone-900/15">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
              Extend the graph
            </p>
            <h2
              id="new-node-title"
              className="mt-1 text-lg font-semibold text-stone-900"
            >
              Add a discourse node
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-1.5 text-xs font-medium text-stone-600">
            Node type
            <select
              value={type}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setType(event.target.value as NodeType)
              }
              className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              {NODE_TYPES.map((nodeType) => (
                <option key={nodeType} value={nodeType}>
                  {NODE_TYPE_CONFIG[nodeType].label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-xs font-medium text-stone-600">
            Content
            <textarea
              autoFocus
              value={text}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                setText(event.target.value)
              }
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter")
                  handleSubmit();
              }}
              placeholder="Write a concise question, claim, or piece of evidence…"
              className="min-h-28 resize-none rounded-lg border border-stone-200 bg-white p-3 text-sm leading-6 text-stone-800 outline-none placeholder:text-stone-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-medium text-stone-600">
            Place under
            <select
              value={parentId ?? ""}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setParentId(event.target.value || null)
              }
              className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="">Top level</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {NODE_TYPE_CONFIG[node.type].label}: {node.text}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="hidden text-xs text-stone-400 sm:block">
            Ctrl/⌘ + Enter to add
          </p>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add node
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DiscourseGraphPrototype = (): ReactElement => {
  const [nodes, setNodes] = useState<DiscourseNode[]>(getSeedNodes);
  const [selectedId, setSelectedId] = useState("question-preregistration");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(getSeedNodes().map((node) => node.id)),
  );
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<NodeType | "all">("all");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerParentId, setComposerParentId] = useState<string | null>(null);
  const [relationshipType, setRelationshipType] =
    useState<RelationshipType>("supports");
  const [relationshipTargetId, setRelationshipTargetId] = useState("");
  const [isDeleteArmed, setIsDeleteArmed] = useState(false);

  const selectedNode =
    nodes.find((node) => node.id === selectedId) ?? nodes[0] ?? null;

  const visibleIds = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = nodes.filter((node) => {
      const matchesQuery =
        !normalizedQuery || node.text.toLowerCase().includes(normalizedQuery);
      const matchesType = typeFilter === "all" || node.type === typeFilter;
      return matchesQuery && matchesType;
    });
    const ids = new Set(matches.map((node) => node.id));

    matches.forEach((node) => {
      let parentId = node.parentId;
      while (parentId) {
        ids.add(parentId);
        parentId =
          nodes.find((candidate) => candidate.id === parentId)?.parentId ??
          null;
      }
    });

    return ids;
  }, [nodes, query, typeFilter]);

  const rootNodes = nodes.filter(
    (node) => node.parentId === null && visibleIds.has(node.id),
  );
  const forceExpanded = query.trim().length > 0 || typeFilter !== "all";
  const inboundLinks = selectedNode
    ? nodes.flatMap((node) =>
        node.links
          .filter((link) => link.targetId === selectedNode.id)
          .map((link) => ({ link, node })),
      )
    : [];
  const availableTargets = selectedNode
    ? nodes.filter((node) => node.id !== selectedNode.id)
    : [];
  const validTargetId = availableTargets.some(
    (node) => node.id === relationshipTargetId,
  )
    ? relationshipTargetId
    : "";

  const handleSelect = (nodeId: string): void => {
    setSelectedId(nodeId);
    setRelationshipTargetId("");
    setIsDeleteArmed(false);
  };

  const handleToggle = (nodeId: string): void => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleCreate = ({
    parentId,
    text,
    type,
  }: {
    parentId: string | null;
    text: string;
    type: NodeType;
  }): void => {
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const node: DiscourseNode = { id, links: [], parentId, text, type };
    setNodes((current) => [...current, node]);
    if (parentId) {
      setExpandedIds((current) => new Set([...current, parentId]));
    }
    setSelectedId(id);
    setIsComposerOpen(false);
    setTypeFilter("all");
    setQuery("");
  };

  const openComposer = (parentId: string | null): void => {
    setComposerParentId(parentId);
    setIsComposerOpen(true);
  };

  const handleDelete = (): void => {
    if (!selectedNode) return;
    if (!isDeleteArmed) {
      setIsDeleteArmed(true);
      return;
    }

    const nextNodes = deleteNode({ nodes, nodeId: selectedNode.id });
    setNodes(nextNodes);
    setSelectedId(selectedNode.parentId ?? nextNodes[0]?.id ?? "");
    setIsDeleteArmed(false);
  };

  const handleReset = (): void => {
    const seedNodes = getSeedNodes();
    setNodes(seedNodes);
    setSelectedId("question-preregistration");
    setExpandedIds(new Set(seedNodes.map((node) => node.id)));
    setQuery("");
    setTypeFilter("all");
    setRelationshipTargetId("");
    setIsDeleteArmed(false);
  };

  const handleAddRelationship = (): void => {
    if (!selectedNode || !validTargetId) return;
    setNodes((current) =>
      addRelationship({
        nodes: current,
        sourceId: selectedNode.id,
        targetId: validTargetId,
        type: relationshipType,
      }),
    );
    setRelationshipTargetId("");
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f5f1] text-stone-900">
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-white transition hover:bg-primary"
              aria-label="Back to Discourse Graphs"
            >
              <Network className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">
                  Discourse Graphs
                </p>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                  Prototype
                </span>
              </div>
              <p className="hidden text-xs text-stone-400 sm:block">
                A small graph you can think through
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-stone-400 md:inline">
              Changes reset when you reload
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 transition hover:border-stone-300 hover:bg-stone-50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reset demo
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">
        <section className="mb-4 flex flex-col justify-between gap-3 px-1 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-stone-400">
              <Link
                href="/"
                className="inline-flex items-center gap-1 hover:text-stone-700"
              >
                <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                Website
              </Link>
              <span>/</span>
              <span>Research synthesis demo</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
              Preregistration and research credibility
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">
              Follow a question into claims, evidence, and sources—then add your
              own idea or connect two nodes.
            </p>
          </div>
          <div className="flex gap-5 text-xs text-stone-400">
            <span>
              <strong className="text-stone-700">{nodes.length}</strong> nodes
            </span>
            <span>
              <strong className="text-stone-700">
                {nodes.reduce((total, node) => total + node.links.length, 0)}
              </strong>{" "}
              links
            </span>
          </div>
        </section>

        <section className="mb-3 grid gap-2 rounded-xl border border-violet-100 bg-violet-50/70 p-3 text-xs leading-5 text-violet-900 sm:grid-cols-[auto_1fr] sm:items-center">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 font-semibold shadow-sm shadow-violet-900/5">
            <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
            Try this
          </span>
          <p>
            Select the first claim, inspect what supports and challenges it,
            then use <strong>Add relationship</strong> to make a new connection.
          </p>
        </section>

        <div className="grid min-h-[680px] flex-1 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm shadow-stone-900/5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section
            className="min-w-0 border-b border-stone-200 lg:border-b-0 lg:border-r"
            aria-label="Discourse outline"
          >
            <div className="flex flex-col gap-3 border-b border-stone-200 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setQuery(event.target.value)
                  }
                  placeholder="Search this graph…"
                  className="h-9 w-full rounded-lg border border-stone-200 bg-stone-50 pl-9 pr-3 text-sm outline-none placeholder:text-stone-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
                  aria-label="Search graph"
                />
              </div>
              <button
                type="button"
                onClick={() => openComposer(selectedNode?.id ?? null)}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-stone-900 px-3.5 text-xs font-semibold text-white transition hover:bg-stone-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New node
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-stone-100 px-3 py-2.5">
              {(["all", ...NODE_TYPES] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    typeFilter === type
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700"
                  }`}
                >
                  {type === "all" ? "All nodes" : NODE_TYPE_CONFIG[type].label}
                </button>
              ))}
            </div>

            <div className="max-h-[720px] overflow-y-auto py-2 lg:h-[calc(100vh-330px)] lg:min-h-[580px]">
              {rootNodes.length > 0 ? (
                <ul>
                  {rootNodes.map((node) => (
                    <OutlineNode
                      key={node.id}
                      node={node}
                      nodes={nodes}
                      depth={0}
                      expandedIds={expandedIds}
                      forceExpanded={forceExpanded}
                      onSelect={handleSelect}
                      onToggle={handleToggle}
                      selectedId={selectedNode?.id ?? ""}
                      visibleIds={visibleIds}
                    />
                  ))}
                </ul>
              ) : (
                <div className="flex h-72 flex-col items-center justify-center px-5 text-center">
                  <Search
                    className="h-6 w-6 text-stone-300"
                    aria-hidden="true"
                  />
                  <p className="mt-3 text-sm font-medium text-stone-700">
                    No nodes found
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setTypeFilter("all");
                    }}
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </section>

          <aside className="bg-stone-50/70" aria-label="Selected node details">
            {selectedNode ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-stone-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <TypeBadge type={selectedNode.type} />
                    <button
                      type="button"
                      onClick={() => openComposer(selectedNode.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Add child
                    </button>
                  </div>

                  <label className="mt-3 block">
                    <span className="sr-only">Node text</span>
                    <textarea
                      value={selectedNode.text}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                        const text = event.target.value;
                        setNodes((current) =>
                          current.map((node) =>
                            node.id === selectedNode.id
                              ? { ...node, text }
                              : node,
                          ),
                        );
                      }}
                      className="min-h-24 w-full resize-none rounded-lg border border-transparent bg-transparent p-1 text-base font-medium leading-6 text-stone-900 outline-none transition hover:border-stone-200 hover:bg-stone-50 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
                    />
                  </label>

                  {selectedNode.sourceUrl && (
                    <a
                      href={selectedNode.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:underline"
                    >
                      Open source
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </div>

                <div className="grid gap-5 p-4">
                  <section>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                        Connections
                      </h2>
                      <span className="text-[11px] text-stone-400">
                        {selectedNode.links.length + inboundLinks.length} total
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2">
                      {selectedNode.links.map((link) => {
                        const target = nodes.find(
                          (node) => node.id === link.targetId,
                        );
                        if (!target) return null;
                        return (
                          <ConnectionRow
                            key={`${link.type}-${link.targetId}`}
                            direction="outgoing"
                            link={link}
                            node={target}
                            onSelect={handleSelect}
                            onRemove={() =>
                              setNodes((current) =>
                                removeRelationship({
                                  nodes: current,
                                  sourceId: selectedNode.id,
                                  targetId: target.id,
                                  type: link.type,
                                }),
                              )
                            }
                          />
                        );
                      })}
                      {inboundLinks.map(({ link, node }) => (
                        <ConnectionRow
                          key={`incoming-${node.id}-${link.type}`}
                          direction="incoming"
                          link={link}
                          node={node}
                          onSelect={handleSelect}
                        />
                      ))}
                      {selectedNode.links.length === 0 &&
                        inboundLinks.length === 0 && (
                          <p className="rounded-lg border border-dashed border-stone-200 p-3 text-xs leading-5 text-stone-400">
                            This node has no explicit links yet. Its outline
                            position still provides context.
                          </p>
                        )}
                    </div>
                  </section>

                  <section>
                    <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                      Add relationship
                    </h2>
                    <div className="mt-2 grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                      <select
                        value={relationshipType}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          setRelationshipType(
                            event.target.value as RelationshipType,
                          )
                        }
                        className="h-9 min-w-0 rounded-lg border border-stone-200 bg-white px-2 text-xs text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                        aria-label="Relationship type"
                      >
                        {RELATIONSHIP_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {RELATIONSHIP_LABELS[type]}
                          </option>
                        ))}
                      </select>
                      <select
                        value={validTargetId}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          setRelationshipTargetId(event.target.value)
                        }
                        className="h-9 min-w-0 rounded-lg border border-stone-200 bg-white px-2 text-xs text-stone-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                        aria-label="Relationship target"
                      >
                        <option value="">Choose a node…</option>
                        {availableTargets.map((node) => (
                          <option key={node.id} value={node.id}>
                            {NODE_TYPE_CONFIG[node.type].label}: {node.text}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddRelationship}
                      disabled={!validTargetId}
                      className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Connect nodes
                    </button>
                  </section>
                </div>

                <div className="mt-auto border-t border-stone-200 p-4">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                      isDeleteArmed
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "text-stone-400 hover:bg-red-50 hover:text-red-700"
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {isDeleteArmed ? "Confirm delete" : "Delete node"}
                  </button>
                  {isDeleteArmed && (
                    <button
                      type="button"
                      onClick={() => setIsDeleteArmed(false)}
                      className="ml-2 rounded-lg px-3 py-2 text-xs font-medium text-stone-500 hover:bg-stone-100"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-stone-400">
                Select a node to see its context.
              </div>
            )}
          </aside>
        </div>
      </main>

      <footer className="mx-auto flex w-full max-w-[1500px] flex-col justify-between gap-2 px-6 pb-6 pt-1 text-xs text-stone-400 sm:flex-row sm:items-center">
        <p>Illustrative demo data · Nothing is saved</p>
        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 font-medium hover:text-stone-700"
        >
          Learn how Discourse Graphs work
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </footer>

      {isComposerOpen && (
        <NodeComposer
          nodes={nodes}
          onClose={() => setIsComposerOpen(false)}
          onCreate={handleCreate}
          suggestedParentId={composerParentId}
        />
      )}
    </div>
  );
};
