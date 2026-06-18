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

/** Matches old collision folders: `{spaceName}-{6-char id}`. */
export const isLegacyCollisionFolderBasename = (
  basename: string,
  spaceName: string,
): boolean => {
  const sanitized = sanitizeImportFolderName(spaceName);
  const prefix = `${sanitized}-`;
  if (!basename.startsWith(prefix)) return false;
  const suffix = basename.slice(prefix.length);
  return /^[a-z0-9]{6}$/.test(suffix);
};

export const isLegacyOrCollisionFolderBasename = (
  basename: string,
  spaceName: string,
): boolean => {
  return (
    isLegacyFolderBasename(basename, spaceName) ||
    isLegacyCollisionFolderBasename(basename, spaceName)
  );
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
  if (isLegacyOrCollisionFolderBasename(basename, spaceName)) return false;
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
  if (!isLegacyOrCollisionFolderBasename(basename, spaceName)) return false;
  return !!userName;
};
