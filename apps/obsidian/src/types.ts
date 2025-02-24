import { Hotkey } from "obsidian";

export type DiscourseNodeType = {
  name: string;
  format: string;
  shortcut?: string;
  color?: string;
};

export type Settings = {
  mySetting: string;
  nodeTypes: DiscourseNodeType[];
  nodeTypeHotkey: Hotkey;
};
