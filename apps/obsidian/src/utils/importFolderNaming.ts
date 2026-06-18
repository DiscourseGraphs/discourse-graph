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

/** Pre-migration names: `{spaceName}` or old collision `{spaceName}-{6-char id}`. */
export const isLegacyImportFolderBasename = (
  basename: string,
  spaceName: string,
): boolean => {
  const sanitized = sanitizeImportFolderName(spaceName);
  if (basename === sanitized) return true;

  const prefix = `${sanitized}-`;
  if (!basename.startsWith(prefix)) return false;
  return /^[a-z0-9]{6}$/.test(basename.slice(prefix.length));
};

export const isUserRenamedFolderBasename = (
  basename: string,
  spaceName: string,
  userName?: string,
): boolean => {
  if (isLegacyImportFolderBasename(basename, spaceName)) return false;
  if (userName && basename === buildImportFolderBasename(userName, spaceName)) {
    return false;
  }
  return true;
};

export const needsLegacyFolderRename = ({
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
  if (!isLegacyImportFolderBasename(basename, spaceName)) return false;
  return !!userName;
};
