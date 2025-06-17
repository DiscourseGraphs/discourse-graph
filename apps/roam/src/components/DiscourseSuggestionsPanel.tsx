import {
  Alignment,
  Card,
  Classes,
  Button,
  Navbar,
  Position,
  Tooltip,
  Intent,
  Collapse,
} from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import deriveDiscourseNodeAttribute from "~/utils/deriveDiscourseNodeAttribute";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getDiscourseContextResults from "~/utils/getDiscourseContextResults";
import findDiscourseNode from "~/utils/findDiscourseNode";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import { getBlockUidFromTarget } from "roamjs-components/dom";
import { Result } from "roamjs-components/types/query-builder";
import { RelationDetails } from "~/utils/hyde";
import SuggestionsBody from "./SuggestionsBody";

const PANEL_ROOT_ID = "discourse-graph-suggestions-root";
const PANELS_CONTAINER_ID = "discourse-graph-panels-container";

type DiscourseData = {
  results: Awaited<ReturnType<typeof getDiscourseContextResults>>;
  refs: number;
};
const cache: {
  [tag: string]: DiscourseData;
} = {};

const getOverlayInfo = async (
  tag: string,
  relations: ReturnType<typeof getDiscourseRelations>,
): Promise<DiscourseData> => {
  try {
    if (cache[tag]) return cache[tag];

    const nodes = getDiscourseNodes(relations);

    const [results, refs] = await Promise.all([
      getDiscourseContextResults({
        uid: getPageUidByPageTitle(tag),
        nodes,
        relations,
      }),
      // @ts-ignore - backend to be added to roamjs-components
      window.roamAlphaAPI.data.backend.q(
        `[:find ?a :where [?b :node/title "${normalizePageTitle(tag)}"] [?a :block/refs ?b]]`,
      ),
    ]);

    return (cache[tag] = {
      results,
      refs: refs.length,
    });
  } catch (error) {
    console.error(`Error getting overlay info for ${tag}:`, error);
    return {
      results: [],
      refs: 0,
    };
  }
};

const getAllReferencesOnPage = (pageTitle: string) => {
  const referencedPages = window.roamAlphaAPI.data.q(
    `[:find ?uid ?text
      :where
        [?page :node/title "${normalizePageTitle(pageTitle)}"]
        [?b :block/page ?page]
        [?b :block/refs ?refPage]
        [?refPage :block/uid ?uid]
        [?refPage :node/title ?text]]`,
  );
  return referencedPages.map(([uid, text]) => ({
    uid,
    text,
  })) as Result[];
};

export const DiscourseSuggestionsPanel = ({
  onClose,
  tag,
  id,
  parentEl,
}: {
  onClose: () => void;
  tag: string;
  id: string;
  parentEl: HTMLElement;
}) => {
  const tagUid = useMemo(() => getPageUidByPageTitle(tag), [tag]);
  const blockUid = useMemo(() => getBlockUidFromTarget(parentEl), [parentEl]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<DiscourseData["results"]>([]);
  const [refs, setRefs] = useState(0);
  const [score, setScore] = useState<number | string>(0);
  const [isOpen, setIsOpen] = useState(true);

  const discourseNode = useMemo(() => findDiscourseNode(tagUid), [tagUid]);
  const relations = useMemo(() => getDiscourseRelations(), []);
  const allNodes = useMemo(() => getDiscourseNodes(), []);

  const getInfo = useCallback(
    () =>
      getOverlayInfo(tag, relations)
        .then(({ refs, results }) => {
          if (!discourseNode) return;
          const attribute = getSettingValueFromTree({
            tree: getBasicTreeByParentUid(discourseNode.type),
            key: "Overlay",
            defaultValue: "Overlay",
          });
          return deriveDiscourseNodeAttribute({
            uid: tagUid,
            attribute,
          }).then((score) => {
            setResults(results);
            setRefs(refs);
            setScore(score);
          });
        })
        .finally(() => setLoading(false)),
    [tag, setResults, setLoading, setRefs, setScore],
  );

  const refresh = useCallback(() => {
    setLoading(true);
    getInfo();
  }, [getInfo, setLoading]);

  useEffect(() => {
    getInfo();
  }, [refresh, getInfo]);

  const validRelations = useMemo(() => {
    if (!discourseNode) return [];
    const selfType = discourseNode.type;

    return relations.filter(
      (relation) =>
        relation.source === selfType || relation.destination === selfType,
    );
  }, [relations, discourseNode]);

  const uniqueRelationTypeTriplets = useMemo(() => {
    if (!discourseNode) return [];
    const relatedNodeType = discourseNode.type;

    return validRelations.flatMap((relation) => {
      const isSelfSource = relation.source === relatedNodeType;
      const isSelfDestination = relation.destination === relatedNodeType;

      let targetNodeType: string;
      let currentRelationLabel: string;

      if (isSelfSource) {
        targetNodeType = relation.destination;
        currentRelationLabel = relation.label;
      } else if (isSelfDestination) {
        targetNodeType = relation.source;
        currentRelationLabel = relation.complement;
      } else {
        return [];
      }

      const identifiedTargetNode = allNodes.find(
        (node) => node.type === targetNodeType,
      );

      if (!identifiedTargetNode) {
        return [];
      }

      const mappedItem: RelationDetails = {
        relationLabel: currentRelationLabel,
        relatedNodeText: identifiedTargetNode.text,
        relatedNodeFormat: identifiedTargetNode.format,
      };
      return [mappedItem];
    });
  }, [validRelations, discourseNode, allNodes]);

  console.log("uniqueRelationTypeTriplets", uniqueRelationTypeTriplets);

  const validTypes = useMemo(() => {
    if (!discourseNode) return [];
    const selfType = discourseNode.type;

    const hasSelfRelation = validRelations.some(
      (relation) =>
        relation.source === selfType && relation.destination === selfType,
    );
    const types = Array.from(
      new Set(
        validRelations.flatMap((relation) => [
          relation.source,
          relation.destination,
        ]),
      ),
    );
    return hasSelfRelation ? types : types.filter((type) => type !== selfType);
  }, [discourseNode, validRelations]);

  console.log("validTypes", validTypes);

  return (
    <Card
      {...{ "data-dg-block-uid": blockUid }}
      style={{
        backgroundColor: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "8px",
      }}
      className="roamjs-discourse-suggestions-panel"
    >
      <Navbar
        style={{
          borderBottom: "1px solid #d8e1e8",
          boxShadow: "none",
          paddingRight: 0,
          display: "flex",
          flexWrap: "nowrap",
          alignItems: "center",
        }}
      >
        {/* Left-aligned group for panel heading */}
        <Navbar.Group align={Alignment.LEFT} style={{ flex: 1, minWidth: 0 }}>
          <Navbar.Heading
            className="truncate"
            style={{
              fontSize: "13px",
              margin: 0,
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => setIsOpen((prev) => !prev)}
          >
            {tag}
          </Navbar.Heading>
        </Navbar.Group>

        {/* Right-aligned group for action buttons */}
        <Navbar.Group
          align={Alignment.RIGHT}
          style={{
            marginRight: "5px",
            flexShrink: 0,
            display: "flex",
            gap: "4px",
          }}
        >
          <Button
            icon={isOpen ? "chevron-up" : "chevron-down"}
            minimal
            small
            onClick={() => setIsOpen((prev) => !prev)}
            title={isOpen ? "Collapse" : "Expand"}
          />
          <Button icon="cog" minimal={true} title="Settings" small={true} />
          <Button
            icon="cross"
            minimal={true}
            title="Close Panel"
            onClick={onClose}
            small={true}
          />
        </Navbar.Group>
      </Navbar>
      <Collapse
        isOpen={isOpen}
        keepChildrenMounted={true}
        transitionDuration={150}
      >
        <div
          className={Classes.CARD}
          style={{ flexGrow: 1, overflowY: "auto", padding: "6px" }}
        >
          <SuggestionsBody
            tag={tag}
            blockUid={blockUid}
            existingResults={results}
          />
        </div>
      </Collapse>
    </Card>
  );
};

// Static method to toggle the suggestions panel
DiscourseSuggestionsPanel.toggle = (
  tag: string,
  id: string,
  parentEl: HTMLElement,
) => {
  // Ensure there is a dedicated root element for all suggestion panels.
  let suggestionsRoot = document.getElementById(
    PANEL_ROOT_ID,
  ) as HTMLElement | null;

  // Always reference Roam's main container – we need it for (un)split logic
  const roamBodyMain = document.querySelector(
    ".roam-body-main",
  ) as HTMLElement | null;

  // If the root does not exist yet, create it and apply the 40/60 split.
  if (!suggestionsRoot && roamBodyMain) {
    const mainContent = roamBodyMain.firstElementChild as HTMLElement | null;
    if (!mainContent) return; // safety-guard – shouldn't happen in a normal Roam page

    suggestionsRoot = document.createElement("div");
    suggestionsRoot.id = PANEL_ROOT_ID;
    suggestionsRoot.style.display = "flex";
    suggestionsRoot.style.flexDirection = "column";
    suggestionsRoot.style.flex = "0 0 40%";

    // Insert the root before Roam's main content area and apply split styling
    roamBodyMain.insertBefore(suggestionsRoot, mainContent);
    roamBodyMain.style.display = "flex";
    mainContent.style.flex = "1 1 60%";
    roamBodyMain.dataset.isSplit = "true";
  }

  // If we still don't have either container, bail
  if (!suggestionsRoot) return;

  // If the root exists but is currently hidden, show it again and re-apply
  // the 40/60 split layout that we use for split view.
  if (
    suggestionsRoot.style.display === "none" &&
    roamBodyMain &&
    !roamBodyMain.dataset.isSplit
  ) {
    const mainContent =
      suggestionsRoot.nextElementSibling as HTMLElement | null;
    suggestionsRoot.style.display = "flex";
    // Ensure the root is sized correctly.
    suggestionsRoot.style.flex = "0 0 40%";

    // Apply flex split styling to the parent container and main content.
    roamBodyMain.style.display = "flex";
    if (mainContent && mainContent !== suggestionsRoot) {
      mainContent.style.flex = "1 1 60%";
    }
    roamBodyMain.dataset.isSplit = "true";
  }

  // From now on, always append the panels container to `suggestionsRoot`.
  const containerParent = suggestionsRoot;

  const panelId = `discourse-panel-${tag.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const existingPanel = document.getElementById(panelId);

  // If this specific panel already exists, close only this panel
  if (existingPanel) {
    ReactDOM.unmountComponentAtNode(existingPanel);
    existingPanel.remove();

    // Check if there are any remaining panels
    const panelsContainer = document.getElementById(
      PANELS_CONTAINER_ID,
    ) as HTMLElement | null;
    const remainingPanels = panelsContainer?.children.length || 0;

    if (remainingPanels === 0 && panelsContainer) {
      panelsContainer.remove();
      // Remove the suggestions root and restore layout
      if (suggestionsRoot?.parentElement) {
        suggestionsRoot.remove();
      }
      if (roamBodyMain && roamBodyMain.dataset.isSplit === "true") {
        roamBodyMain.removeAttribute("data-is-split");
        roamBodyMain.style.display = "";
        const mainContent =
          roamBodyMain.firstElementChild as HTMLElement | null;
        if (mainContent) {
          mainContent.style.flex = "";
        }
      }
    }
    return;
  }

  // Ensure there is only one panels container in the entire document
  let panelsContainer = document.getElementById(
    PANELS_CONTAINER_ID,
  ) as HTMLElement | null;

  // If a container exists but is NOT inside the intended parent, move it.
  if (panelsContainer && panelsContainer.parentElement !== containerParent) {
    panelsContainer.parentElement?.removeChild(panelsContainer);
    containerParent.appendChild(panelsContainer);
  }

  // Create the panels container if it does not exist yet
  if (!panelsContainer) {
    panelsContainer = document.createElement("div");
    panelsContainer.id = PANELS_CONTAINER_ID;
    panelsContainer.style.display = "flex";
    panelsContainer.style.flexDirection = "column";
    panelsContainer.style.flex = "1 1 auto";
    panelsContainer.style.gap = "8px";
    panelsContainer.style.padding = "8px";
    panelsContainer.style.backgroundColor = "#f5f5f5";
    panelsContainer.style.overflowY = "auto";

    containerParent.appendChild(panelsContainer);

    // Common header shown once per container
    const headerCardId = "discourse-suggestions-header";
    const headerCard = document.createElement("div");
    headerCard.id = headerCardId;
    headerCard.style.flex = "0 0 auto";
    headerCard.style.padding = "6px 8px";
    headerCard.style.backgroundColor = "#fff";
    headerCard.style.borderRadius = "4px 4px 0 0";
    headerCard.style.marginBottom = "0";
    headerCard.style.fontWeight = "600";
    headerCard.style.fontSize = "13px";
    headerCard.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
    headerCard.style.display = "flex";
    headerCard.style.justifyContent = "space-between";
    headerCard.style.alignItems = "center";

    panelsContainer.appendChild(headerCard);

    const headerTitle = document.createElement("span");
    headerTitle.textContent = "Suggested Discourse nodes";

    const closeSidebarBtn = document.createElement("button");
    closeSidebarBtn.textContent = "✕";
    closeSidebarBtn.style.cursor = "pointer";
    closeSidebarBtn.style.border = "none";
    closeSidebarBtn.style.background = "transparent";
    closeSidebarBtn.title = "Close sidebar";

    closeSidebarBtn.onclick = () => {
      // Simulate clicking Split View button if present to close
      const splitBtn = document.querySelector(
        '[title="Split View"]',
      ) as HTMLElement | null;
      if (splitBtn) {
        splitBtn.click();
      } else {
        // Fallback: manually hide suggestions root and restore layout
        const panelRoot = document.getElementById(
          PANEL_ROOT_ID,
        ) as HTMLElement | null;
        if (panelRoot) {
          panelRoot.style.display = "none";
        }
        const roamBodyMain = document.querySelector(
          ".roam-body-main",
        ) as HTMLElement | null;
        if (roamBodyMain) {
          roamBodyMain.removeAttribute("data-is-split");
          roamBodyMain.style.display = "";
          const mainContent =
            roamBodyMain.firstElementChild as HTMLElement | null;
          if (mainContent) mainContent.style.flex = "";
        }
      }
    };

    headerCard.appendChild(headerTitle);
    headerCard.appendChild(closeSidebarBtn);
  }

  // Create the new panel
  const newPanel = document.createElement("div");
  newPanel.id = panelId;
  newPanel.style.flex = "0 0 auto";
  newPanel.style.marginBottom = "8px";
  newPanel.style.marginTop = "0";
  newPanel.style.backgroundColor = "#fff";
  newPanel.style.borderRadius = "0 0 4px 4px";
  newPanel.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";

  panelsContainer.appendChild(newPanel);

  const handleClosePanel = () => {
    ReactDOM.unmountComponentAtNode(newPanel);
    newPanel.remove();

    // Check if there are any remaining panels
    const remainingPanels = panelsContainer?.children.length || 0;

    if (remainingPanels === 0) {
      panelsContainer.remove();
      // Remove the suggestions root and restore layout
      if (suggestionsRoot?.parentElement) {
        suggestionsRoot.remove();
      }
      if (roamBodyMain && roamBodyMain.dataset.isSplit === "true") {
        roamBodyMain.removeAttribute("data-is-split");
        roamBodyMain.style.display = "";
        const mainContent =
          roamBodyMain.firstElementChild as HTMLElement | null;
        if (mainContent) {
          mainContent.style.flex = "";
        }
      }
    }
  };

  ReactDOM.render(
    <DiscourseSuggestionsPanel
      onClose={handleClosePanel}
      tag={tag}
      id={id}
      parentEl={parentEl}
    />,
    newPanel,
  );
};
