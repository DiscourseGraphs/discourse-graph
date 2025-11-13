import { App, TFile } from "obsidian";

export const openFileInSidebar = async (app: App, file: TFile): Promise<void> => {
  const rightSplit = app.workspace.rightSplit;
  const rightLeaf = app.workspace.getRightLeaf(false);

  if (rightLeaf) {
    if (rightSplit && rightSplit.collapsed) {
      rightSplit.expand();
    }
    await rightLeaf.openFile(file);
    app.workspace.setActiveLeaf(rightLeaf);
  } else {
    const leaf = app.workspace.getLeaf("split", "vertical");
    await leaf.openFile(file);
    app.workspace.setActiveLeaf(leaf);
  }
};

export const openFileInNewTab = async (app: App, file: TFile): Promise<void> => {
  const leaf = app.workspace.getLeaf("tab");
  await leaf.openFile(file);
  app.workspace.setActiveLeaf(leaf);
};
 
