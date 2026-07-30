// Version is injected during build process
declare global {
  interface Window {
    __DISCOURSE_GRAPH_VERSION__?: string;
    __DISCOURSE_GRAPH_BUILD_DATE__?: string;
    __DISCOURSE_GRAPH_BUILD_COMMIT__?: string;
    __DISCOURSE_GRAPH_BUILD_BRANCH__?: string;
  }
}

export type VersionMetadata = {
  version: string;
  buildDate: string;
  buildCommit: string;
  buildBranch: string;
  versionStamp: string;
};

const SHORT_COMMIT_LENGTH = 8;
const FALLBACK_VALUE = "-";

const hasMetadataValue = (value: string | undefined): value is string =>
  Boolean(value?.trim() && value.trim() !== FALLBACK_VALUE);

export const normalizeBuildBranch = (
  buildBranch: string | undefined,
): string | undefined => {
  if (!hasMetadataValue(buildBranch)) return undefined;

  const branch = buildBranch.trim();
  if (
    !branch ||
    branch === "main" ||
    branch === "master" ||
    branch === "HEAD"
  ) {
    return undefined;
  }

  const normalized = branch
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || undefined;
};

const getShortCommit = (
  buildCommit: string | undefined,
): string | undefined => {
  if (!hasMetadataValue(buildCommit)) return undefined;
  return buildCommit.trim().slice(0, SHORT_COMMIT_LENGTH);
};

export const createVersionStamp = ({
  version,
  buildDate,
  buildCommit,
  buildBranch,
}: Omit<VersionMetadata, "versionStamp">): string => {
  const parts = [
    version || FALLBACK_VALUE,
    buildDate || FALLBACK_VALUE,
    normalizeBuildBranch(buildBranch),
    getShortCommit(buildCommit),
  ].filter(hasMetadataValue);

  return parts.length > 0 ? parts.join("-") : FALLBACK_VALUE;
};

export const getVersionWithDate = (): VersionMetadata => {
  if (typeof window === "undefined") {
    return {
      version: FALLBACK_VALUE,
      buildDate: FALLBACK_VALUE,
      buildCommit: FALLBACK_VALUE,
      buildBranch: FALLBACK_VALUE,
      versionStamp: FALLBACK_VALUE,
    };
  }

  const metadata = {
    version: window.__DISCOURSE_GRAPH_VERSION__ || FALLBACK_VALUE,
    buildDate: window.__DISCOURSE_GRAPH_BUILD_DATE__ || FALLBACK_VALUE,
    buildCommit: window.__DISCOURSE_GRAPH_BUILD_COMMIT__ || FALLBACK_VALUE,
    buildBranch: window.__DISCOURSE_GRAPH_BUILD_BRANCH__ || FALLBACK_VALUE,
  };

  return {
    ...metadata,
    versionStamp: createVersionStamp(metadata),
  };
};
