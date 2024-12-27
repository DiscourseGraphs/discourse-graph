import { createConfigObserver } from "roamjs-components/components/ConfigPage";
import {
  CustomField,
  Field,
  FlagField,
  SelectField,
} from "roamjs-components/components/ConfigPanels/types";
import DiscourseNodeConfigPanel from "./components/settings/DiscourseNodeConfigPanel";
import DiscourseRelationConfigPanel from "./components/settings/DiscourseRelationConfigPanel";
import CustomPanel from "roamjs-components/components/ConfigPanels/CustomPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import NumberPanel from "roamjs-components/components/ConfigPanels/NumberPanel";
import MultiTextPanel from "roamjs-components/components/ConfigPanels/MultiTextPanel";
import SelectPanel from "roamjs-components/components/ConfigPanels/SelectPanel";
import DEFAULT_RELATION_VALUES from "./data/defaultDiscourseRelations";
import { OnloadArgs } from "roamjs-components/types";
import getDiscourseNodes, {
  excludeDefaultNodes,
} from "./utils/getDiscourseNodes";
import refreshConfigTree from "./utils/refreshConfigTree";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import { render } from "./components/DiscourseNodeMenu";
import DiscourseContext from "./components/DiscourseContext";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import isDiscourseNode from "./utils/isDiscourseNode";
import addStyle from "roamjs-components/dom/addStyle";
import { registerSelection } from "./utils/predefinedSelections";
import deriveNodeAttribute from "./utils/deriveDiscourseNodeAttribute";
import matchDiscourseNode from "./utils/matchDiscourseNode";
import getPageTitleValueByHtmlElement from "roamjs-components/dom/getPageTitleValueByHtmlElement";
import React from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import createPage from "roamjs-components/writes/createPage";
import INITIAL_NODE_VALUES from "./data/defaultDiscourseNodes";
import CanvasReferences from "./components/canvas/CanvasReferences";
import { render as renderGraphOverviewExport } from "./components/ExportDiscourseContext";
import styles from "./styles/discourseGraphStyles.css";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "./settings/configPages";
import { formatHexColor } from "./components/settings/DiscourseNodeCanvasSettings";
import {
  onPageRefObserverChange,
  overlayPageRefHandler,
  previewPageRefHandler,
} from "./utils/pageRefObserverHandlers";

const initializeDiscourseGraphsMode = async (args: OnloadArgs) => {
  const unloads = new Set<() => void>();

  refreshConfigTree();

  return () => {
    unloads.forEach((u) => u());
    unloads.clear();
  };
};

export default initializeDiscourseGraphsMode;
