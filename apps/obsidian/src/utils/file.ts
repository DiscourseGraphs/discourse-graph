import { TAbstractFile, TFolder, Vault, normalizePath } from "obsidian";

export async function checkAndCreateFolder(folderpath: string, vault: Vault) {
  // If path is empty, no need to create a folder
  if (!folderpath) return;

  const abstractItem = vault.getAbstractFileByPath(folderpath);
  if (abstractItem instanceof TFolder) return;
  if (abstractItem instanceof TAbstractFile) {
    throw new Error(`${folderpath} exists as a file`);
  }
  await vault.createFolder(folderpath);
}

export function getNewUniqueFilepath(
  vault: Vault,
  filename: string,
  folderpath: string,
): string {
  let fname = normalizePath(`${folderpath}/${filename}`);
  let num = 1;

  while (vault.getAbstractFileByPath(fname) != null) {
    const ext = filename.split(".").pop();
    const base = filename.replace(/\.[^/.]+$/, "");
    fname = normalizePath(`${folderpath}/${base} ${num}.${ext}`);
    num++;
  }

  return fname;
}
