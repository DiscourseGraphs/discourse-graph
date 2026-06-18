export const sanitizeImportFolderName = (fileName: string): string => {
  return fileName
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

export const buildImportFolderBasename = (
  userName: string,
  spaceName: string,
): string => {
  return sanitizeImportFolderName(`${userName}-${spaceName}`);
};
