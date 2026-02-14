import { Vault, normalizePath } from "obsidian";

export const checkAndCreateFolder = async (
  folderpath: string,
  vault: Vault,
) => {
  if (!folderpath) return;
  const normalizedPath = normalizePath(folderpath);

  const existingFolder = await vault.adapter.exists(normalizedPath, false);
  if (existingFolder) return;

  try {
    await vault.createFolder(normalizedPath);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (
      message.includes("Folder already exists") ||
      message.includes("already exists")
    ) {
      return;
    }
    throw e;
  }
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
