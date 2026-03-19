// Unofficial Obsidian APIs — may break on Obsidian updates.
// Only declare what we actually use.
import "obsidian";

declare module "obsidian" {
  // module has to be declared using interface instead of type to merge with the official types
  interface Workspace {
    on(
      name: "file-menu",
      callback: (menu: Menu, file: TFile) => void,
    ): EventRef;
  }

  interface MenuItem {
    setSubmenu(): Menu;
  }
}
