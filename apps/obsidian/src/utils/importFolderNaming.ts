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

export const isLegacyFolderBasename = (
  basename: string,
  spaceName: string,
): boolean => {
  return basename === sanitizeImportFolderName(spaceName);
};

export const isExpectedMigratedBasename = (
  basename: string,
  userName: string,
  spaceName: string,
): boolean => {
  return basename === buildImportFolderBasename(userName, spaceName);
};

export const isCustomFolderBasename = ({
  basename,
  spaceName,
  userName,
}: {
  basename: string;
  spaceName: string;
  userName?: string;
}): boolean => {
  if (isLegacyFolderBasename(basename, spaceName)) return false;
  if (userName && isExpectedMigratedBasename(basename, userName, spaceName)) {
    return false;
  }
  return true;
};

export const shouldAutoRenameFolder = ({
  metadata,
  basename,
  spaceName,
  userName,
}: {
  metadata: { migrated?: boolean };
  basename: string;
  spaceName: string;
  userName?: string;
}): boolean => {
  if (metadata.migrated) return false;
  if (!isLegacyFolderBasename(basename, spaceName)) return false;
  return !!userName;
};
