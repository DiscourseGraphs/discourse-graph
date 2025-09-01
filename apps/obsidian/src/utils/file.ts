import { TAbstractFile, TFolder, Vault, normalizePath } from "obsidian";

export const checkAndCreateFolder = async (folderpath: string, vault: Vault) => {
  if (!folderpath) return;

  const abstractItem = vault.getAbstractFileByPath(folderpath);
  if (abstractItem instanceof TFolder) return;
  if (abstractItem instanceof TAbstractFile) {
    throw new Error(`${folderpath} exists as a file`);
  }
  await vault.createFolder(folderpath);
};

export const getNewUniqueFilepath = ({
  vault,
  filename,
  folderpath,
}: {
  vault: Vault;
  filename: string;
  folderpath: string;
}): string => {
  let fname = normalizePath(`${folderpath}/${filename}`);
  let num = 1;

  while (vault.getAbstractFileByPath(fname) != null) {
    const ext = filename.split(".").pop();
    const base = filename.replace(/\.[^/.]+$/, "");
    fname = normalizePath(`${folderpath}/${base} ${num}.${ext}`);
    num++;
  }

  return fname;
};