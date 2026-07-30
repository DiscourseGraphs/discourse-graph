import type { VersionMetadata } from "./getVersion";

export type ExtensionTelemetryProperties = VersionMetadata & {
  extensionInstallId: string;
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const INSTALL_ID_STORAGE_KEY = "discourse-graphs:roam:extension-install-id";
const FALLBACK_VALUE = "-";

const hasTelemetryValue = (value: string | undefined | null): value is string =>
  Boolean(value?.trim() && value.trim() !== FALLBACK_VALUE);

const createRuntimeId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const normalizeTelemetryValue = (value: string | undefined | null): string =>
  hasTelemetryValue(value) ? value.trim() : FALLBACK_VALUE;

export const getOrCreateExtensionInstallId = ({
  storage,
  createId = createRuntimeId,
}: {
  storage?: StorageLike | null;
  createId?: () => string;
} = {}): string => {
  if (!storage) return createId();

  let installId: string | undefined;
  try {
    const existingId = storage.getItem(INSTALL_ID_STORAGE_KEY);
    if (hasTelemetryValue(existingId)) return existingId.trim();

    installId = createId();
    storage.setItem(INSTALL_ID_STORAGE_KEY, installId);
    return installId;
  } catch {
    return installId || createId();
  }
};

export const buildExtensionTelemetryProperties = ({
  versionMetadata,
  storage,
  createInstallId,
}: {
  versionMetadata: VersionMetadata;
  storage?: StorageLike | null;
  createInstallId?: () => string;
}): ExtensionTelemetryProperties => ({
  version: normalizeTelemetryValue(versionMetadata.version),
  buildDate: normalizeTelemetryValue(versionMetadata.buildDate),
  buildCommit: normalizeTelemetryValue(versionMetadata.buildCommit),
  buildBranch: normalizeTelemetryValue(versionMetadata.buildBranch),
  versionStamp: normalizeTelemetryValue(versionMetadata.versionStamp),
  extensionInstallId: getOrCreateExtensionInstallId({
    storage,
    createId: createInstallId,
  }),
});
