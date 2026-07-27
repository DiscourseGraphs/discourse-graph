import "obsidian";

declare module "obsidian" {
  /* eslint-disable @typescript-eslint/consistent-type-definitions -- Unofficial Obsidian APIs — may break on Obsidian updates. Only declare what we actually use.*/
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

  interface App {
    setting: {
      open: () => void;
      openTabById: (id: string) => void;
    };
  }
  /* eslint-enable @typescript-eslint/consistent-type-definitions -- end unofficial Obsidian API augmentations */
}
