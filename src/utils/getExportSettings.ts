import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { RoamBasicNode } from "roamjs-components/types";
import { getSubTree } from "roamjs-components/util";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/settings/configPages";

type UidPair<T> = {
  uid?: string;
  value: T;
};

export type BooleanSetting = UidPair<boolean>;
export type IntSetting = UidPair<number>;
export type StringSetting = UidPair<string>;

export type ExportConfigWithUids = {
  exportUid: string;
  maxFilenameLength: IntSetting;
  openSidebar: BooleanSetting;
  removeSpecialCharacters: BooleanSetting;
  simplifiedFilename: BooleanSetting;
  optsEmbeds: BooleanSetting;
  optsRefs: BooleanSetting;
  linkType: StringSetting;
  appendRefNodeContext: BooleanSetting;
  frontmatter: {
    uid?: string;
    values: string[];
  };
};

export type ExportConfig = {
  exportUid: string;
  maxFilenameLength: number;
  openSidebar: boolean;
  removeSpecialCharacters: boolean;
  simplifiedFilename: boolean;
  optsEmbeds: boolean;
  optsRefs: boolean;
  linkType: string;
  appendRefNodeContext: boolean;
  frontmatter: string[];
};

type Props = {
  tree: RoamBasicNode[];
  text: string;
};
export const getUidAndIntSetting = (props: Props): IntSetting => {
  const node = props.tree.find((node) => node.text === props.text);
  return {
    uid: node?.uid,
    value: parseInt(node?.children[0]?.text || "0"),
  };
};
export const getUidAndBooleanSetting = (props: Props): BooleanSetting => {
  const node = props.tree.find((node) => node.text === props.text);
  return {
    uid: node?.uid,
    value: !!node?.uid,
  };
};
export const getUidAndStringSetting = (props: Props): StringSetting => {
  const node = props.tree.find((node) => node.text === props.text);
  return {
    uid: node?.uid,
    value: node?.children[0]?.text || node?.text || "",
  };
};

export const getExportSettingsAndUids = (): ExportConfigWithUids => {
  const configTree = getBasicTreeByParentUid(
    getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE)
  );
  const exportNode = getSubTree({ tree: configTree, key: "export" });
  const tree = exportNode.children;
  const exportNodeUid = exportNode.uid;

  const getInt = (text: string) => getUidAndIntSetting({ tree, text });
  const getBoolean = (text: string) => getUidAndBooleanSetting({ tree, text });
  const getString = (text: string) => getUidAndStringSetting({ tree, text });

  // max filename length default to 64
  const { uid: maxFilenameLengthUid, value: maxFilenameLength = 64 } = getInt(
    "max filename length"
  );
  const frontmatterNode = getSubTree({
    tree,
    key: "frontmatter",
  });

  return {
    exportUid: exportNodeUid || "",
    removeSpecialCharacters: getBoolean("remove special characters"),
    simplifiedFilename: getBoolean("simplified filename"),
    optsEmbeds: getBoolean("resolve block embeds"),
    optsRefs: getBoolean("resolve block references"),
    linkType: getString("link type"),
    appendRefNodeContext: getBoolean("append referenced node"),
    openSidebar: getBoolean("open sidebar"),
    maxFilenameLength: {
      uid: maxFilenameLengthUid,
      value: maxFilenameLength,
    },
    frontmatter: {
      uid: frontmatterNode.uid,
      values: frontmatterNode.children.map((t) => t.text),
    },
  };
};

export const getExportSettings = (): Omit<ExportConfig, "exportUid"> => {
  const settings = getExportSettingsAndUids();
  return {
    maxFilenameLength: settings.maxFilenameLength.value,
    openSidebar: settings.openSidebar.value,
    removeSpecialCharacters: settings.removeSpecialCharacters.value,
    simplifiedFilename: settings.simplifiedFilename.value,
    optsEmbeds: settings.optsEmbeds.value,
    optsRefs: settings.optsRefs.value,
    linkType: settings.linkType.value,
    appendRefNodeContext: settings.appendRefNodeContext.value,
    frontmatter: settings.frontmatter.values,
  };
};
