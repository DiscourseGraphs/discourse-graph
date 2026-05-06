import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { RoamBasicNode } from "roamjs-components/types";
import { getSubTree } from "roamjs-components/util";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/data/constants";
import { bulkReadSettings } from "~/components/settings/utils/accessors";
import { EXPORT_KEYS } from "~/components/settings/utils/settingKeys";

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

export const getExportSettingsAndUids = (
  configTreeOverride?: RoamBasicNode[],
): ExportConfigWithUids => {
  const configTree =
    configTreeOverride ??
    getBasicTreeByParentUid(getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE));
  const exportNode = getSubTree({ tree: configTree, key: "export" });
  const tree = exportNode.children;
  const exportNodeUid = exportNode.uid;

  const getInt = (text: string) => getUidAndIntSetting({ tree, text });
  const getBoolean = (text: string) => getUidAndBooleanSetting({ tree, text });
  const getString = (text: string) => getUidAndStringSetting({ tree, text });

  // max filename length default to 64
  const { uid: maxFilenameLengthUid, value: maxFilenameLength = 64 } = getInt(
    "max filename length",
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
  const exportValues = bulkReadSettings().globalSettings.Export;
  const legacy = getExportSettingsAndUids();
  return {
    maxFilenameLength: exportValues[EXPORT_KEYS.maxFilenameLength],
    removeSpecialCharacters: exportValues[EXPORT_KEYS.removeSpecialCharacters],
    optsEmbeds: exportValues[EXPORT_KEYS.resolveBlockEmbeds],
    optsRefs: exportValues[EXPORT_KEYS.resolveBlockReferences],
    linkType: exportValues[EXPORT_KEYS.linkType],
    appendRefNodeContext: exportValues[EXPORT_KEYS.appendReferencedNode],
    frontmatter: exportValues[EXPORT_KEYS.frontmatter],
    openSidebar: legacy.openSidebar.value,
    simplifiedFilename: legacy.simplifiedFilename.value,
  };
};
