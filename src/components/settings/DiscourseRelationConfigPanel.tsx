import {
  Alert,
  Button,
  InputGroup,
  Intent,
  Label,
  Menu,
  MenuItem,
  Spinner,
  SpinnerSize,
  Tab,
  Tabs,
  Tooltip,
} from "@blueprintjs/core";
import type cytoscape from "cytoscape";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import type {
  InputTextNode,
  RoamBasicNode,
  TreeNode,
} from "roamjs-components/types";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import setInputSetting from "roamjs-components/util/setInputSetting";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import useSubTree from "roamjs-components/hooks/useSubTree";
import refreshConfigTree from "~/utils/refreshConfigTree";
import triplesToBlocks from "~/utils/triplesToBlocks";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import { render as renderToast } from "roamjs-components/components/Toast";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import { CustomField } from "roamjs-components/components/ConfigPanels/types";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import { getConditionLabels } from "~/utils/conditionToDatalog";

const DEFAULT_SELECTED_RELATION = {
  display: "none",
  top: 0,
  left: 0,
  relation: "references",
  id: "",
};

const RelationEditPreview = ({ previewUid }: { previewUid: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (el)
      window.roamAlphaAPI.ui.components.renderBlock({
        el,
        uid: previewUid,
      });
  }, [previewUid, containerRef]);
  return (
    <div ref={containerRef} className={"roamjs-discourse-editor-preview"}></div>
  );
};

const edgeDisplayByUid = (uid: string) =>
  uid === "*"
    ? "Any"
    : getPageTitleByPageUid(uid).replace(/^discourse-graph\/nodes\//, "") ||
      getTextByBlockUid(uid);

const RelationEditPanel = ({
  editingRelationInfo,
  nodes,
  back,
  translatorKeys,
  previewUid,
}: {
  editingRelationInfo: TreeNode;
  back: () => void;
  nodes: Record<string, { label: string; format: string }>;
  translatorKeys: string[];
  previewUid: string;
}) => {
  const nodeFormatsByLabel = useMemo(
    () =>
      Object.fromEntries(
        Object.values(nodes).map(({ label, format }) => [label, format])
      ),
    [nodes]
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const cyRef = useRef<cytoscape.Core>();
  const sourceRef = useRef<cytoscape.NodeSingular>();
  const editingRef = useRef<cytoscape.NodeSingular>();
  const blockClickRef = useRef(false);
  const showBackWarning = useRef(false);
  const unsavedChanges = useCallback(
    () => (showBackWarning.current = true),
    [showBackWarning]
  );
  const [backWarningOpen, setBackWarningOpen] = useState(false);
  const clearEditingRef = useCallback(() => {
    if (editingRef.current) {
      editingRef.current.style("border-width", 0);
      editingRef.current.unlock();
      editingRef.current = undefined;
    }
  }, [editingRef]);
  const clearSourceRef = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.style("background-color", "#888888");
      sourceRef.current.unlock();
      sourceRef.current = undefined;
    }
  }, [sourceRef]);
  const [selectedRelation, setSelectedRelation] = useState(
    DEFAULT_SELECTED_RELATION
  );
  const [tab, setTab] = useState(0);
  const initialSourceUid = useMemo(
    () =>
      getSettingValueFromTree({
        tree: editingRelationInfo.children,
        key: "source",
      }),
    []
  );
  const initialSource = useMemo(
    () => edgeDisplayByUid(initialSourceUid),
    [initialSourceUid]
  );
  const [source, setSource] = useState(initialSourceUid);
  const initialDestinationUid = useMemo(
    () =>
      getSettingValueFromTree({
        tree: editingRelationInfo.children,
        key: "destination",
      }),
    []
  );
  const initialDestination = useMemo(
    () => edgeDisplayByUid(initialDestinationUid),
    [initialDestinationUid]
  );
  const [destination, setDestination] = useState(initialDestinationUid);
  const [complement, setComplement] = useState(
    getSettingValueFromTree({
      tree: editingRelationInfo.children,
      key: "complement",
    })
  );
  const edgeCallback = useCallback(
    (edge: cytoscape.EdgeSingular) => {
      edge.on("click", (e) => {
        if (blockClickRef.current) {
          return;
        }
        e.stopPropagation();
        clearEditingRef();
        clearSourceRef();
        if (e.originalEvent.ctrlKey) {
          cyRef.current?.remove(edge);
          unsavedChanges();
        } else {
          setSelectedRelation({
            display: "block",
            top: e.position.y,
            left: e.position.x,
            relation: edge.data("relation"),
            id: edge.id(),
          });
        }
      });
    },
    [
      clearSourceRef,
      clearEditingRef,
      setSelectedRelation,
      cyRef,
      blockClickRef,
      unsavedChanges,
    ]
  );
  const nodeCallback = useCallback(
    (n: cytoscape.NodeSingular) => {
      n.on("click", (e) => {
        if (blockClickRef.current) {
          return;
        }
        e.stopPropagation();
        setSelectedRelation(DEFAULT_SELECTED_RELATION);
        if (
          e.originalEvent.ctrlKey &&
          !["source", "destination"].includes(n.id())
        ) {
          clearSourceRef();
          clearEditingRef();
          cyRef.current?.remove(n);
          unsavedChanges();
        } else if (e.originalEvent.shiftKey) {
          clearEditingRef();
          if (sourceRef.current) {
            const source = sourceRef.current.id();
            const target = n.id();
            if (source !== target) {
              const data = {
                id: `${source}-${target}`,
                source,
                target,
                relation: "references",
              };
              if (
                cyRef.current &&
                cyRef.current
                  .edges()
                  .every((e) => (e as cytoscape.EdgeSingular).id() !== data.id)
              ) {
                const edge = cyRef.current?.add({ data })[0];
                if (edge) edgeCallback(edge);
              }
            }
            clearSourceRef();
          } else if (!["source", "destination"].includes(n.id())) {
            n.style("background-color", "#000000");
            n.lock();
            sourceRef.current = n;
          }
        } else {
          clearSourceRef();
          if (editingRef.current) {
            clearEditingRef();
          } else if (!["source", "destination"].includes(n.id())) {
            editingRef.current = n;
            editingRef.current.lock();
            containerRef.current?.focus();
            n.style("border-width", 4);
          }
        }
      });

      n.on("dragfree", unsavedChanges);
    },
    [
      sourceRef,
      cyRef,
      edgeCallback,
      editingRef,
      containerRef,
      clearEditingRef,
      clearSourceRef,
      blockClickRef,
      unsavedChanges,
    ]
  );
  const ifTree = useMemo(
    () =>
      editingRelationInfo.children.find((t) => toFlexRegex("if").test(t.text))
        ?.children || [],
    [editingRelationInfo]
  );
  const initialElements = useMemo(
    () =>
      ifTree.map((andTree) => {
        const initialNodes = [
          initialSource,
          initialDestination,
          "source",
          "destination",
        ];
        const { nodes, edges, positions } = andTree.children.reduce(
          ({ nodes, edges, positions }, node) => {
            const source = node.text;
            if (toFlexRegex("node positions").test(source)) {
              return {
                nodes,
                edges,
                positions: Object.fromEntries(
                  node.children.map((c) => [c.text, c.children[0]?.text])
                ),
              };
            } else {
              if (!initialNodes.includes(source)) nodes.add(source);
              const target = node.children[0]?.children?.[0]?.text || "";
              if (!initialNodes.includes(target)) nodes.add(target);
              edges.add({
                source,
                target,
                relation: (node.children[0]?.text || "").toLowerCase(),
              });
              return { nodes, edges, positions };
            }
          },
          {
            nodes: new Set(),
            edges: new Set<{
              source: string;
              target: string;
              relation: string;
            }>(),
            positions: {} as Record<string, string>,
          }
        );
        const elementNodes = Array.from(nodes)
          .map((node) => ({ id: (idRef.current++).toString(), node }))
          .concat([
            { id: "source", node: initialSource },
            { id: "destination", node: initialDestination },
          ])
          .map((data, i, all) => ({
            data,
            position: positions[data.id]
              ? {
                  x: Number(positions[data.id].split(" ")[0]),
                  y: Number(positions[data.id].split(" ")[1]),
                }
              : {
                  x: Math.sin((2 * Math.PI * i) / all.length) * 150 + 200,
                  y: Math.cos((2 * Math.PI * i) / all.length) * 150 + 200,
                },
          }));
        return [
          ...elementNodes,
          ...Array.from(edges).map(({ source, target, relation }) => {
            const sourceId = elementNodes.find((n) => n.data.node === source)
              ?.data?.id;
            const targetId = ["source", "destination"].includes(target)
              ? target
              : elementNodes.find((n) => n.data.node === target)?.data?.id;
            return {
              data: {
                id: `${sourceId}-${targetId}`,
                source: sourceId,
                target: targetId,
                relation,
              },
            };
          }),
        ];
      }),
    [ifTree, initialDestination, initialSource]
  );
  const elementsRef = useRef(
    initialElements.length
      ? initialElements
      : [
          [
            {
              data: {
                id: "source",
                node: initialSource,
              },
              position: {
                x: 200,
                y: 50,
              },
            },
            {
              data: {
                id: "destination",
                node: initialDestination,
              },
              position: {
                x: 200,
                y: 350,
              },
            },
          ],
        ]
  );
  const saveCyToElementRef = useCallback(
    (t: number) => {
      const nodes = cyRef.current?.nodes() || [];
      const edges = cyRef.current?.edges() || [];
      elementsRef.current[t] = [
        ...nodes.map((n) => ({ data: n.data(), position: n.position() })),
        ...edges.map((n) => ({ data: n.data() })),
      ];
    },
    [cyRef, elementsRef]
  );
  const [tabs, setTabs] = useState(
    initialElements.length ? initialElements.map((_, i) => i) : [0]
  );

  const loadCytoscape = useCallback(async () => {
    cyRef.current?.destroy?.();
    const cytoscape = await window.RoamLazy?.Cytoscape();
    if (!cytoscape) return;
    const cy = cytoscape({
      container: containerRef.current,
      elements: elementsRef.current[tab],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#888888",
            label: "data(node)",
            shape: "round-rectangle",
            color: "#ffffff",
            "text-wrap": "wrap",
            "text-halign": "center",
            "text-valign": "center",
            "text-max-width": "54",
            width: 60,
            height: 60,
            "font-size": 12,
            "border-color": "black",
          },
        },
        {
          selector: "edge",
          style: {
            width: 10,
            "line-color": "#ccc",
            "target-arrow-color": "#ccc",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(relation)",
          },
        },
      ],

      layout: {
        name: "preset",
        padding: 40,
      },
      zoomingEnabled: false,
      userZoomingEnabled: false,
      panningEnabled: false,
      userPanningEnabled: false,
      boxSelectionEnabled: false,
    });
    cyRef.current = cy;
    cy.on("click", (e) => {
      if (blockClickRef.current) {
        return;
      }
      const { position } = e;
      const id = (idRef.current++).toString();
      const node = cy.add({
        data: { id, node: `Block${id}` },
        position,
      });
      unsavedChanges();
      nodeCallback(node);
      clearEditingRef();
      clearSourceRef();
      setSelectedRelation(DEFAULT_SELECTED_RELATION);
    });
    cyRef.current.nodes().forEach(nodeCallback);
    cyRef.current.edges().forEach(edgeCallback);
    cyRef.current.nodes(`#source`).style("background-color", "darkblue");
    cyRef.current.nodes(`#destination`).style("background-color", "darkred");
  }, [
    cyRef,
    containerRef,
    elementsRef,
    idRef,
    blockClickRef,
    nodeCallback,
    edgeCallback,
    setSelectedRelation,
    tab,
    unsavedChanges,
  ]);
  useEffect(() => {
    loadCytoscape();
  }, [loadCytoscape]);
  const [isPreview, setIsPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const triples = elementsRef.current[tab]
      .filter((d) => !!(d.data as { relation?: string }).relation)
      .map(
        (d) =>
          d as {
            data: { relation: string; source: string; target: string };
          }
      )
      .map((d) => ({
        relation: d.data.relation,
        source: (
          elementsRef.current[tab].find((n) => n.data.id === d.data.source)
            ?.data as { node: string }
        )?.node,
        target: (
          elementsRef.current[tab].find((n) => n.data.id === d.data.target)
            ?.data as { node: string }
        )?.node,
      }));
    Promise.all(
      getShallowTreeByParentUid(previewUid).map(({ uid }) => deleteBlock(uid))
    )
      .then(() => updateBlock({ uid: previewUid, open: true }))
      .then(() => {
        let order = 0;
        return triplesToBlocks({
          defaultPageTitle: "Any Page",
          toPage: (text, children) =>
            createBlock({
              node: { text, children, open: true },
              parentUid: previewUid,
              order: order++,
            }).then(() => Promise.resolve()),
          nodeFormatsByLabel,
        })(triples)();
      });
  }, [previewUid, tab, elementsRef, nodeFormatsByLabel]);
  return (
    <>
      <h3
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {editingRelationInfo.text}
        <Button
          icon={"arrow-left"}
          disabled={loading}
          minimal
          onClick={() =>
            showBackWarning.current ? setBackWarningOpen(true) : back()
          }
        />
        <Alert
          cancelButtonText={"Cancel"}
          confirmButtonText={"Confirm"}
          onConfirm={back}
          intent={Intent.WARNING}
          isOpen={backWarningOpen}
          onCancel={() => setBackWarningOpen(false)}
        >
          <b>Warning:</b> You have unsaved changes. Are you sure you want to go
          back and discard these changes?
        </Alert>
      </h3>
      <div style={{ display: "flex" }}>
        <Label style={{ flexGrow: 1, color: "darkblue" }}>
          Source
          <MenuItemSelect
            activeItem={source}
            onItemSelect={(e) => {
              if (cyRef.current) {
                unsavedChanges();
                setSource(e);
                (cyRef.current.nodes("#source") as cytoscape.NodeSingular).data(
                  "node",
                  nodes[e]?.label
                );
              }
            }}
            items={Object.keys(nodes)}
            transformItem={(u) => nodes[u]?.label}
            ButtonProps={{ style: { color: "darkblue" } }}
          />
        </Label>
        <Label style={{ flexGrow: 1, color: "darkred" }}>
          Destination
          <MenuItemSelect
            activeItem={destination}
            onItemSelect={(e) => {
              if (cyRef.current) {
                unsavedChanges();
                setDestination(e);
                (
                  cyRef.current.nodes("#destination") as cytoscape.NodeSingular
                ).data("node", nodes[e]?.label);
              }
            }}
            items={Object.keys(nodes)}
            transformItem={(u) => nodes[u]?.label}
            ButtonProps={{ style: { color: "darkred" } }}
          />
        </Label>
        <Label style={{ flexGrow: 1 }}>
          Complement
          <InputGroup
            value={complement}
            onChange={(e) => {
              unsavedChanges();
              setComplement(e.target.value);
            }}
          />
        </Label>
      </div>
      <div>
        <Tabs
          selectedTabId={tab}
          onChange={(id) => {
            saveCyToElementRef(tab);
            setTab(id as number);
          }}
        >
          {tabs.map((i) => (
            <Tab key={i} id={i} title={i} />
          ))}
          <Button
            icon={"plus"}
            minimal
            disabled={loading}
            onClick={() => {
              const newId = (tabs.slice(-1)[0] || 0) + 1;
              saveCyToElementRef(tab);
              elementsRef.current.push([
                {
                  data: { id: "source", node: initialSource },
                  position: {
                    x: 200,
                    y: 50,
                  },
                },
                {
                  data: { id: "destination", node: initialDestination },
                  position: {
                    x: 200,
                    y: 350,
                  },
                },
              ]);
              setTabs([...tabs, newId]);
              setTab(newId);
              unsavedChanges();
            }}
          />
        </Tabs>
      </div>
      <div className={"roamjs-discourse-edit-relations"}>
        <div
          tabIndex={-1}
          ref={containerRef}
          style={{ height: "100%", display: isPreview ? "none" : "block" }}
          onKeyDown={(e) => {
            if (editingRef.current) {
              if (e.key === "Enter") {
                editingRef.current.style("border-width", 0);
                editingRef.current.unlock();
                editingRef.current = undefined;
              } else if (e.key === "Backspace") {
                editingRef.current.data(
                  "node",
                  editingRef.current.data("node").slice(0, -1)
                );
              } else if (/\w/.test(e.key) && e.key.length === 1) {
                editingRef.current.data(
                  "node",
                  `${editingRef.current.data("node")}${e.key}`
                );
              } else if (e.key === " ") {
                e.preventDefault();
              }
              unsavedChanges();
            }
          }}
        />
        {isPreview && <RelationEditPreview previewUid={previewUid} />}
        <Menu
          style={{
            position: "absolute",
            ...selectedRelation,
            zIndex: 1,
            background: "#eeeeee",
          }}
        >
          {translatorKeys
            .filter((k) => k !== selectedRelation.relation)
            .map((k) => (
              <MenuItem
                key={k}
                text={k}
                onMouseDown={() => (blockClickRef.current = true)}
                onClick={(e: React.MouseEvent) => {
                  if (cyRef.current) {
                    blockClickRef.current = false;
                    (
                      cyRef.current.edges(
                        `#${selectedRelation.id}`
                      ) as cytoscape.EdgeSingular
                    ).data("relation", k);
                    setSelectedRelation(DEFAULT_SELECTED_RELATION);
                    e.stopPropagation();
                  }
                }}
              />
            ))}
        </Menu>
        <div style={{ zIndex: 1, position: "absolute", top: 8, right: 8 }}>
          {tabs.length > 1 && (
            <Tooltip content={"Delete"}>
              <Button
                minimal
                icon={"trash"}
                disabled={loading}
                onClick={() => {
                  const newTabs = tabs.filter((t) => t != tab);
                  setTabs(newTabs);
                  setTab(newTabs[0]);
                  unsavedChanges();
                }}
                style={{ marginRight: 8 }}
              />
            </Tooltip>
          )}
          <Tooltip content={isPreview ? "Edit" : "Preview"}>
            <Button
              minimal
              icon={isPreview ? "edit" : "eye-open"}
              onClick={() => {
                if (!isPreview) {
                  saveCyToElementRef(tab);
                }
                setIsPreview(!isPreview);
              }}
              disabled={loading}
              style={{ marginRight: 8 }}
            />
          </Tooltip>
          {!!localStorage.getItem("roamjs:discourse-relation-copy") && (
            <Tooltip content={"Paste Relation"}>
              <Button
                minimal
                icon={"clipboard"}
                disabled={loading}
                style={{ marginRight: 8 }}
                onClick={() => {
                  elementsRef.current[tab] = JSON.parse(
                    localStorage.getItem("roamjs:discourse-relation-copy") ||
                      "{}"
                  ).map((n: { data: { id: string } }) =>
                    n.data.id === "source"
                      ? {
                          ...n,
                          data: {
                            ...n.data,
                            node: source,
                          },
                        }
                      : n.data.id === "destination"
                      ? {
                          ...n,
                          data: {
                            ...n.data,
                            node: destination,
                          },
                        }
                      : n
                  );
                  loadCytoscape();
                }}
              />
            </Tooltip>
          )}
          <Tooltip content={"Copy Relation"}>
            <Button
              minimal
              icon={"duplicate"}
              disabled={loading}
              onClick={() => {
                saveCyToElementRef(tab);
                localStorage.setItem(
                  "roamjs:discourse-relation-copy",
                  JSON.stringify(elementsRef.current[tab])
                );
                renderToast({
                  id: "relation-copy",
                  content: "Copied Relation",
                  intent: Intent.PRIMARY,
                });
              }}
            />
          </Tooltip>
        </div>
      </div>
      <div style={{ display: "flex" }}>
        <Button
          text={"Save"}
          intent={Intent.PRIMARY}
          disabled={loading}
          style={{ marginTop: 10, marginRight: 16 }}
          onClick={() => {
            setLoading(true);
            setTimeout(async () => {
              const rootUid = editingRelationInfo.uid;
              setInputSetting({
                blockUid: rootUid,
                key: "source",
                value: source,
              });
              setInputSetting({
                blockUid: rootUid,
                key: "destination",
                value: destination,
                index: 1,
              });
              setInputSetting({
                blockUid: rootUid,
                key: "complement",
                value: complement,
                index: 2,
              });
              const ifUid =
                editingRelationInfo.children.find((t) =>
                  toFlexRegex("if").test(t.text)
                )?.uid ||
                (await createBlock({
                  node: { text: "If" },
                  parentUid: rootUid,
                  order: 3,
                }));
              saveCyToElementRef(tab);
              const blocks = tabs
                .map((t) => elementsRef.current[t])
                .map((elements) => ({
                  text: "And",
                  children: elements
                    .filter((e) => e.data.id.includes("-"))
                    .map((e) => {
                      const { source, target, relation } = e.data as {
                        source: string;
                        target: string;
                        relation: string;
                      };
                      return {
                        text: (
                          elements.find((e) => e.data.id === source)?.data as {
                            node: string;
                          }
                        )?.node,
                        children: [
                          {
                            text: relation,
                            children: [
                              {
                                text: ["source", "destination"].includes(target)
                                  ? target
                                  : (
                                      elements.find((e) => e.data.id === target)
                                        ?.data as { node: string }
                                    )?.node,
                              },
                            ],
                          },
                        ],
                      };
                    })
                    .concat([
                      {
                        text: "node positions",
                        children: elements
                          .filter(
                            (
                              e
                            ): e is {
                              data: { id: string; node: unknown };
                              position: { x: number; y: number };
                            } => Object.keys(e).includes("position")
                          )
                          .map((e) => ({
                            text: e.data.id,
                            children: [
                              { text: `${e.position.x} ${e.position.y}` },
                            ],
                          })),
                      },
                    ]),
                }));
              await Promise.all(
                getShallowTreeByParentUid(ifUid).map(({ uid }) =>
                  deleteBlock(uid)
                )
              );
              await Promise.all(
                blocks.map((block, order) =>
                  createBlock({ parentUid: ifUid, node: block, order })
                )
              );
              refreshConfigTree();
              back();
            }, 1);
          }}
        />
        {loading && <Spinner size={SpinnerSize.SMALL} />}
      </div>
    </>
  );
};

const DiscourseRelationConfigPanel: CustomField["options"]["component"] = ({
  uid,
  parentUid,
}) => {
  const refreshRelations = useCallback(
    () =>
      uid
        ? getBasicTreeByParentUid(uid).map((n) => {
            const { children: fieldTree, ...node } = n;
            return {
              ...node,
              source: fieldTree.find((t) => toFlexRegex("source").test(t.text))
                ?.children?.[0]?.text,
              destination: fieldTree.find((t) =>
                toFlexRegex("destination").test(t.text)
              )?.children?.[0]?.text,
            };
          })
        : [],
    [uid]
  );
  const nodes = useMemo(() => {
    const nodes = Object.fromEntries(
      getDiscourseNodes().map((n) => [
        n.type,
        { label: n.text, format: n.format },
      ])
    );
    // TypeError: Iterator value * is not an entry object
    nodes["*"] = { label: "Any", format: ".+" };
    return nodes;
  }, []);
  const previewUid = useSubTree({ parentUid, key: "preview" }).uid;
  const [translatorKeys, setTranslatorKeys] = useState(getConditionLabels);
  const [relations, setRelations] = useState(refreshRelations);
  const [editingRelation, setEditingRelation] = useState("");
  const [newRelation, setNewRelation] = useState("");
  const editingRelationInfo = useMemo(
    () =>
      editingRelation ? getFullTreeByParentUid(editingRelation) : undefined,
    [editingRelation]
  );
  const onNewRelation = () => {
    createBlock({
      parentUid: uid,
      order: relations.length,
      node: { text: newRelation },
    }).then((relationUid) => {
      setRelations([
        ...relations,
        {
          text: newRelation,
          uid: relationUid,
          source: "?",
          destination: "?",
        },
      ]);
      setNewRelation("");
      setEditingRelation(relationUid);
    });
  };
  return editingRelationInfo ? (
    <RelationEditPanel
      nodes={nodes}
      editingRelationInfo={editingRelationInfo}
      back={() => {
        setEditingRelation("");
        setRelations(refreshRelations());
      }}
      translatorKeys={translatorKeys}
      previewUid={previewUid}
    />
  ) : (
    <>
      <div>
        <div style={{ display: "flex" }}>
          <InputGroup
            value={newRelation}
            onChange={(e) => setNewRelation(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !!newRelation && onNewRelation()
            }
          />
          <Button
            onClick={onNewRelation}
            text={"Add Relation"}
            style={{ maxWidth: 120, marginLeft: 8 }}
            intent={Intent.PRIMARY}
            disabled={!newRelation}
          />
        </div>
      </div>
      <ul style={{ listStyle: "none", paddingInlineStart: 16 }}>
        {relations.map((rel) => (
          <li key={rel.uid}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                <span style={{ display: "inline-block", width: 96 }}>
                  {rel.text}
                </span>
                <span style={{ fontSize: 10 }}>
                  ({nodes[rel.source || ""]?.label}) {"=>"} (
                  {nodes[rel.destination || ""]?.label})
                </span>
              </span>
              <span>
                <Tooltip content={"Duplicate"}>
                  <Button
                    icon={"duplicate"}
                    minimal
                    onClick={() => {
                      const baseText = rel.text
                        .split(" ")
                        .filter((s) => !/^\(\d+\)$/.test(s))
                        .join(" ");
                      const copy = relations.reduce((p, c) => {
                        if (c.text.startsWith(baseText)) {
                          const copyIndex = Number(
                            /\((\d+)\)$/.exec(c.text)?.[1]
                          );
                          if (copyIndex && copyIndex > p) {
                            return copyIndex;
                          }
                        }
                        return p;
                      }, 0);
                      const text = `${rel.text} (${copy + 1})`;
                      const copyTree = getBasicTreeByParentUid(rel.uid);
                      const stripUid = (n: RoamBasicNode[]): InputTextNode[] =>
                        n.map((c) => ({
                          text: c.text,
                          children: stripUid(c.children),
                        }));
                      createBlock({
                        parentUid: uid,
                        order: relations.length,
                        node: {
                          text,
                          children: stripUid(copyTree),
                        },
                      }).then((newUid) =>
                        setRelations([
                          ...relations,
                          {
                            uid: newUid,
                            source: rel.source,
                            destination: rel.destination,
                            text,
                          },
                        ])
                      );
                    }}
                  />
                </Tooltip>
                <Tooltip content={"Edit"}>
                  <Button
                    icon={"edit"}
                    minimal
                    onClick={() => {
                      setEditingRelation(rel.uid);
                    }}
                  />
                </Tooltip>
                <Tooltip content={"Delete"}>
                  <Button
                    icon={"delete"}
                    minimal
                    onClick={() => {
                      deleteBlock(rel.uid);
                      setRelations(relations.filter((r) => r.uid !== rel.uid));
                    }}
                  />
                </Tooltip>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};

export default DiscourseRelationConfigPanel;
