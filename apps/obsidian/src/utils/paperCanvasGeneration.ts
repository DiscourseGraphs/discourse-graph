import dagre from "dagre";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";
import { Notice, TFile } from "obsidian";
import { format } from "date-fns";
import {
  createBindingId,
  createShapeId,
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
  getIndexAbove,
  PageRecordType,
  type IndexKey,
  type TLParentId,
  type TLRecord,
  type TLShapeId,
} from "tldraw";
import type DiscourseGraphPlugin from "~/index";
import { FRONTMATTER_KEY, VIEW_TYPE_TLDRAW_DG_PREVIEW } from "~/constants";
import {
  codeBlockTemplate,
  createRawTldrawFile,
  frontmatterTemplate,
  getTLDataTemplate,
  tlFileTemplate,
} from "~/components/canvas/utils/tldraw";
import { addWikilinkBlockrefForFile } from "~/components/canvas/stores/assetStore";
import {
  DiscourseNodeUtil,
  type DiscourseNodeShape,
} from "~/components/canvas/shapes/DiscourseNodeShape";
import {
  DiscourseRelationUtil,
  type DiscourseRelationShape,
} from "~/components/canvas/shapes/DiscourseRelationShape";
import { DiscourseRelationBindingUtil } from "~/components/canvas/shapes/DiscourseRelationBinding";
import { discourseNodeMigrations } from "~/components/canvas/shapes/discourseNodeMigrations";
import { checkAndCreateFolder, getNewUniqueFilepath } from "~/utils/file";
import { findExistingPaperNodesForSourceFile } from "~/utils/paperGraphExtraction";
import {
  getNodeInstanceIdForFile,
  loadRelations,
} from "~/utils/relationsStore";
import { getRelationTypeById } from "~/utils/typeUtils";
import { toTldrawColor } from "~/utils/tldrawColors";
import { calcDiscourseNodeSize } from "~/utils/calcDiscourseNodeSize";

const LOG_PREFIX = "[paper canvas generation]";
const CANVAS_MARGIN = 80;

export type PaperCanvasLayoutMode = "dagre" | "force";

type PaperCanvasNode = {
  id: string;
  file: TFile;
  nodeTypeId: string;
  title: string;
  w: number;
  h: number;
  x: number;
  y: number;
  src: string;
  shapeId: TLShapeId;
};

type PaperCanvasRelation = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationTypeId: string;
  relationInstanceId: string;
};

type PaperCanvasGraph = {
  nodes: PaperCanvasNode[];
  relations: PaperCanvasRelation[];
};

type ForceNode = SimulationNodeDatum & {
  id: string;
  w: number;
  h: number;
};

type ForceLink = {
  source: string;
  target: string;
  relationTypeId: string;
};

const createCanvasFile = async (
  plugin: DiscourseGraphPlugin,
  sourceFile: TFile,
  layoutMode: PaperCanvasLayoutMode,
): Promise<TFile> => {
  const folderpath = plugin.settings.canvasFolderPath;
  await checkAndCreateFolder(folderpath, plugin.app.vault);

  const filename = `Paper Graph ${layoutMode} - ${sourceFile.basename} - ${format(
    new Date(),
    "yyyy-MM-dd-HHmm",
  )}.md`;
  const path = getNewUniqueFilepath({
    vault: plugin.app.vault,
    filename,
    folderpath,
  });

  const frontmatter = frontmatterTemplate(`${FRONTMATTER_KEY}: true`, [
    "paper-graph-demo",
  ]);
  return plugin.app.vault.create(path, tlFileTemplate(frontmatter, ""));
};

const loadPersistedPaperRelations = async ({
  plugin,
  nodeFileByInstanceId,
  nodeIdByInstanceId,
}: {
  plugin: DiscourseGraphPlugin;
  nodeFileByInstanceId: Map<string, TFile>;
  nodeIdByInstanceId: Map<string, string>;
}): Promise<PaperCanvasRelation[]> => {
  const relationsFile = await loadRelations(plugin);
  const relationInstances = Object.values(relationsFile.relations);
  const relations = relationInstances.flatMap((relation) => {
    const sourceFile = nodeFileByInstanceId.get(relation.source);
    const targetFile = nodeFileByInstanceId.get(relation.destination);
    const sourceNodeId = nodeIdByInstanceId.get(relation.source);
    const targetNodeId = nodeIdByInstanceId.get(relation.destination);

    if (!sourceFile || !targetFile || !sourceNodeId || !targetNodeId) {
      return [];
    }

    return [
      {
        id: relation.id,
        sourceNodeId,
        targetNodeId,
        relationTypeId: relation.type,
        relationInstanceId: relation.id,
      },
    ];
  });

  console.log(`${LOG_PREFIX} loaded persisted paper relations`, {
    relationCount: relations.length,
    relations,
  });

  return relations;
};

const measureAndLinkNodes = async ({
  plugin,
  canvasFile,
  sourceFile,
}: {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  sourceFile: TFile;
}): Promise<{
  nodes: PaperCanvasNode[];
  nodeFileByInstanceId: Map<string, TFile>;
  nodeIdByInstanceId: Map<string, string>;
}> => {
  const existingNodes = await findExistingPaperNodesForSourceFile({
    plugin,
    sourceFile,
  });

  console.log(`${LOG_PREFIX} found generated paper nodes`, {
    count: existingNodes.length,
    nodes: existingNodes.map(({ extractedNode, file }) => ({
      id: extractedNode.id,
      path: file.path,
      title: file.basename,
      nodeTypeId: extractedNode.nodeTypeConfig.id,
    })),
  });

  const nodes: PaperCanvasNode[] = [];
  const nodeFileByInstanceId = new Map<string, TFile>();
  const nodeIdByInstanceId = new Map<string, string>();

  for (const { extractedNode, file } of existingNodes) {
    const nodeInstanceId = await getNodeInstanceIdForFile(plugin, file);
    if (!nodeInstanceId) {
      console.warn(`${LOG_PREFIX} skipped node without nodeInstanceId`, {
        path: file.path,
      });
      continue;
    }

    const { w, h } = await calcDiscourseNodeSize({
      title: file.basename,
      nodeTypeId: extractedNode.nodeTypeConfig.id,
      plugin,
      size: "m",
      fontFamily: "sans",
    });
    const src = await addWikilinkBlockrefForFile({
      app: plugin.app,
      canvasFile,
      linkedFile: file,
    });

    nodes.push({
      id: extractedNode.id,
      file,
      nodeTypeId: extractedNode.nodeTypeConfig.id,
      title: file.basename,
      w,
      h,
      x: 0,
      y: 0,
      src,
      shapeId: createShapeId(),
    });
    nodeFileByInstanceId.set(nodeInstanceId, file);
    nodeIdByInstanceId.set(nodeInstanceId, extractedNode.id);
  }

  console.log(`${LOG_PREFIX} measured and linked nodes`, {
    count: nodes.length,
    nodes: nodes.map(({ id, title, w, h, src }) => ({ id, title, w, h, src })),
  });

  return { nodes, nodeFileByInstanceId, nodeIdByInstanceId };
};

const applyDagreLayout = (graph: PaperCanvasGraph): PaperCanvasGraph => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: "LR",
    nodesep: 110,
    ranksep: 180,
    marginx: CANVAS_MARGIN,
    marginy: CANVAS_MARGIN,
  });

  graph.nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: node.w, height: node.h });
  });
  graph.relations.forEach((relation) => {
    dagreGraph.setEdge(relation.sourceNodeId, relation.targetNodeId);
  });

  console.log(`${LOG_PREFIX} dagre input`, {
    nodes: graph.nodes.map(({ id, w, h }) => ({ id, w, h })),
    relations: graph.relations,
  });

  dagre.layout(dagreGraph);

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  const positionedNodes = graph.nodes.map((node) => {
    const dagreNode = dagreGraph.node(node.id) as
      | { x?: number; y?: number }
      | undefined;
    const x = (dagreNode?.x ?? 0) - node.w / 2;
    const y = (dagreNode?.y ?? 0) - node.h / 2;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    return { ...node, x, y };
  });

  const normalizedNodes = positionedNodes.map((node) => ({
    ...node,
    x: node.x - minX + CANVAS_MARGIN,
    y: node.y - minY + CANVAS_MARGIN,
  }));

  console.log(`${LOG_PREFIX} dagre output`, {
    nodes: normalizedNodes.map(({ id, title, x, y, w, h }) => ({
      id,
      title,
      x,
      y,
      w,
      h,
    })),
  });

  return {
    ...graph,
    nodes: normalizedNodes,
  };
};

const seededRandom = (seed = 42): (() => number) => {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
};

const applyForceLayout = (graph: PaperCanvasGraph): PaperCanvasGraph => {
  const nodeCount = Math.max(graph.nodes.length, 1);
  const radius = Math.max(450, nodeCount * 70);
  const forceNodes: ForceNode[] = graph.nodes.map((node, index) => {
    const angle = (index / nodeCount) * Math.PI * 2;
    return {
      id: node.id,
      w: node.w,
      h: node.h,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
  const forceLinks: ForceLink[] = graph.relations.map((relation) => ({
    source: relation.sourceNodeId,
    target: relation.targetNodeId,
    relationTypeId: relation.relationTypeId,
  }));

  console.log(`${LOG_PREFIX} force layout input`, {
    nodes: forceNodes.map(({ id, w, h, x, y }) => ({ id, w, h, x, y })),
    relations: forceLinks,
  });

  const simulation = forceSimulation<ForceNode>(forceNodes)
    .randomSource(seededRandom())
    .force(
      "link",
      forceLink<ForceNode, ForceLink>(forceLinks)
        .id((node) => node.id)
        .distance(340)
        .strength(0.28),
    )
    .force("charge", forceManyBody<ForceNode>().strength(-1400))
    .force(
      "collide",
      forceCollide<ForceNode>()
        .radius((node) => Math.hypot(node.w, node.h) / 2 + 55)
        .strength(0.9)
        .iterations(3),
    )
    .force("center", forceCenter(0, 0))
    .force("x", forceX<ForceNode>(0).strength(0.02))
    .force("y", forceY<ForceNode>(0).strength(0.02))
    .stop();

  for (let i = 0; i < 600; i++) {
    simulation.tick();
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  const positionsById = new Map(
    forceNodes.map((node) => {
      const x = (node.x ?? 0) - node.w / 2;
      const y = (node.y ?? 0) - node.h / 2;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      return [node.id, { x, y }];
    }),
  );

  const normalizedNodes = graph.nodes.map((node) => {
    const position = positionsById.get(node.id) ?? { x: 0, y: 0 };
    return {
      ...node,
      x: position.x - minX + CANVAS_MARGIN,
      y: position.y - minY + CANVAS_MARGIN,
    };
  });

  console.log(`${LOG_PREFIX} force layout output`, {
    nodes: normalizedNodes.map(({ id, title, x, y, w, h }) => ({
      id,
      title,
      x,
      y,
      w,
      h,
    })),
  });

  return {
    ...graph,
    nodes: normalizedNodes,
  };
};

const applyLayout = (
  graph: PaperCanvasGraph,
  layoutMode: PaperCanvasLayoutMode,
): PaperCanvasGraph =>
  layoutMode === "force" ? applyForceLayout(graph) : applyDagreLayout(graph);

const nextIndex = (current: IndexKey | undefined): IndexKey =>
  getIndexAbove(current);

const createNodeShapeRecord = ({
  node,
  parentId,
  index,
}: {
  node: PaperCanvasNode;
  parentId: TLParentId;
  index: IndexKey;
}): DiscourseNodeShape => ({
  id: node.shapeId,
  typeName: "shape",
  type: "discourse-node",
  x: node.x,
  y: node.y,
  rotation: 0,
  index,
  parentId,
  isLocked: false,
  opacity: 1,
  meta: {},
  props: {
    w: node.w,
    h: node.h,
    src: node.src,
    title: node.title,
    nodeTypeId: node.nodeTypeId,
    imageSrc: undefined,
    size: "m",
    fontFamily: "sans",
  },
});

const createRelationShapeRecord = ({
  relation,
  sourceNode,
  targetNode,
  plugin,
  parentId,
  index,
}: {
  relation: PaperCanvasRelation;
  sourceNode: PaperCanvasNode;
  targetNode: PaperCanvasNode;
  plugin: DiscourseGraphPlugin;
  parentId: TLParentId;
  index: IndexKey;
}): DiscourseRelationShape => {
  const relationType = getRelationTypeById(plugin, relation.relationTypeId);
  return {
    id: createShapeId(),
    typeName: "shape",
    type: "discourse-relation",
    x: sourceNode.x + sourceNode.w,
    y: sourceNode.y + sourceNode.h / 2,
    rotation: 0,
    index,
    parentId,
    isLocked: false,
    opacity: 1,
    meta: { relationInstanceId: relation.relationInstanceId },
    props: {
      dash: "draw",
      size: "m",
      fill: "none",
      color: toTldrawColor(relationType?.color),
      labelColor: "black",
      bend: 0,
      start: { x: 0, y: 0 },
      end: {
        x: targetNode.x - (sourceNode.x + sourceNode.w),
        y: targetNode.y + targetNode.h / 2 - (sourceNode.y + sourceNode.h / 2),
      },
      arrowheadStart: "none",
      arrowheadEnd: "arrow",
      text: relationType?.label ?? "",
      labelPosition: 0.5,
      font: "draw",
      scale: 1,
      kind: "arc",
      elbowMidPoint: 0,
      relationTypeId: relation.relationTypeId,
    },
  };
};

const buildTldrawRecords = ({
  plugin,
  canvasFile,
  graph,
}: {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  graph: PaperCanvasGraph;
}): TLRecord[] => {
  const page = PageRecordType.create({
    name: "Page 1",
    index: getIndexAbove(),
  });
  const records: TLRecord[] = [page];
  let currentIndex: IndexKey | undefined;

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));

  graph.nodes.forEach((node) => {
    currentIndex = nextIndex(currentIndex);
    records.push(
      createNodeShapeRecord({
        node,
        parentId: page.id,
        index: currentIndex,
      }) as unknown as TLRecord,
    );
  });

  graph.relations.forEach((relation) => {
    const sourceNode = nodesById.get(relation.sourceNodeId);
    const targetNode = nodesById.get(relation.targetNodeId);
    if (!sourceNode || !targetNode) return;

    currentIndex = nextIndex(currentIndex);
    const relationShape = createRelationShapeRecord({
      relation,
      sourceNode,
      targetNode,
      plugin,
      parentId: page.id,
      index: currentIndex,
    });
    records.push(relationShape as unknown as TLRecord);
    records.push(
      {
        id: createBindingId(),
        typeName: "binding",
        type: "discourse-relation",
        fromId: relationShape.id,
        toId: sourceNode.shapeId,
        meta: {},
        props: {
          terminal: "start",
          normalizedAnchor: { x: 1, y: 0.5 },
          isPrecise: false,
          isExact: false,
          snap: "none",
        },
      } as unknown as TLRecord,
      {
        id: createBindingId(),
        typeName: "binding",
        type: "discourse-relation",
        fromId: relationShape.id,
        toId: targetNode.shapeId,
        meta: {},
        props: {
          terminal: "end",
          normalizedAnchor: { x: 0, y: 0.5 },
          isPrecise: false,
          isExact: false,
          snap: "none",
        },
      } as unknown as TLRecord,
    );
  });

  console.log(`${LOG_PREFIX} generated tldraw records`, {
    recordCount: records.length,
    shapeCount: records.filter((record) => record.typeName === "shape").length,
    bindingCount: records.filter((record) => record.typeName === "binding")
      .length,
    canvasFile: canvasFile.path,
  });

  return records;
};

const writeCanvasStore = async ({
  plugin,
  canvasFile,
  records,
}: {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  records: TLRecord[];
}): Promise<void> => {
  const store = createTLStore({
    shapeUtils: [
      ...defaultShapeUtils,
      DiscourseNodeUtil.configure({
        app: plugin.app,
        canvasFile,
        plugin,
      }),
      DiscourseRelationUtil.configure({
        app: plugin.app,
        canvasFile,
        plugin,
      }),
    ],
    bindingUtils: [...defaultBindingUtils, DiscourseRelationBindingUtil],
    migrations: [discourseNodeMigrations],
  });

  store.put(records);

  const tldrawFile = createRawTldrawFile(store);
  const tlData = getTLDataTemplate({
    pluginVersion: plugin.manifest.version,
    tldrawFile,
    uuid: window.crypto.randomUUID(),
  });
  const codeblock = codeBlockTemplate(tlData);
  const currentContent = await plugin.app.vault.read(canvasFile);

  console.log(`${LOG_PREFIX} generated tldraw store`, {
    rawRecordCount: tldrawFile.records.length,
    schemaKeys: Object.keys(tldrawFile.schema ?? {}),
  });

  await plugin.app.vault.modify(
    canvasFile,
    `${currentContent.trimEnd()}\n\n${codeblock}`,
  );
};

export const createPaperGraphCanvasFromCurrentNote = async ({
  plugin,
  sourceFile,
  layoutMode = "dagre",
}: {
  plugin: DiscourseGraphPlugin;
  sourceFile: TFile;
  layoutMode?: PaperCanvasLayoutMode;
}): Promise<TFile | null> => {
  console.log(`${LOG_PREFIX} starting canvas generation`, {
    sourceFile: sourceFile.path,
    layoutMode,
  });

  const canvasFile = await createCanvasFile(plugin, sourceFile, layoutMode);
  console.log(`${LOG_PREFIX} created canvas file`, {
    canvasFile: canvasFile.path,
    layoutMode,
  });

  const { nodes, nodeFileByInstanceId, nodeIdByInstanceId } =
    await measureAndLinkNodes({
      plugin,
      canvasFile,
      sourceFile,
    });

  if (nodes.length === 0) {
    new Notice("No generated paper nodes found for the current note", 5000);
    return null;
  }

  const relations = await loadPersistedPaperRelations({
    plugin,
    nodeFileByInstanceId,
    nodeIdByInstanceId,
  });
  const graph = applyLayout({ nodes, relations }, layoutMode);
  const records = buildTldrawRecords({ plugin, canvasFile, graph });
  await writeCanvasStore({ plugin, canvasFile, records });

  console.log(`${LOG_PREFIX} finished canvas generation`, {
    sourceFile: sourceFile.path,
    canvasFile: canvasFile.path,
    nodeCount: graph.nodes.length,
    relationCount: graph.relations.length,
    layoutMode,
  });

  const leaf = plugin.app.workspace.getLeaf(false);
  await leaf.openFile(canvasFile);
  await leaf.setViewState({
    type: VIEW_TYPE_TLDRAW_DG_PREVIEW,
    state: { file: canvasFile.path },
  });

  new Notice(
    `Created ${layoutMode} paper graph canvas with ${graph.nodes.length} node(s) and ${graph.relations.length} relation(s).`,
    5000,
  );

  return canvasFile;
};
