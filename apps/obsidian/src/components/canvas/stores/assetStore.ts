import { App, TFile } from "obsidian";
import { TLAsset, TLAssetStore, TLAssetId, TLAssetContext } from "tldraw";
import { JsonObject } from "@tldraw/utils";

const ASSET_PREFIX = "obsidian.blockref.";
type BlockRefAssetId = `${typeof ASSET_PREFIX}${string}`;
type AssetDataUrl = string;

type AssetStoreOptions = {
  app: App;
  file: TFile;
};

/**
 * Extract the block reference id from either an asset src string (e.g.,
 * `asset:obsidian.blockref.<id>`) or from the internal asset id with the
 * `obsidian.blockref.` prefix. Returns null if the input is not a blockref.
 */
export const extractBlockRefId = (assetIdOrSrc?: string): string | null => {
  if (!assetIdOrSrc) return null;
  // From app-level src: asset:obsidian.blockref.<id>
  if (assetIdOrSrc.startsWith("asset:")) {
    const raw = assetIdOrSrc.split(":")[1] ?? "";
    if (!raw.startsWith(ASSET_PREFIX)) return null;
    return raw.slice(ASSET_PREFIX.length);
  }
  // From internal asset id: obsidian.blockref.<id>
  if (assetIdOrSrc.startsWith(ASSET_PREFIX)) {
    return assetIdOrSrc.slice(ASSET_PREFIX.length);
  }
  return null;
};

/**
 * Given a block reference id present in the current canvas markdown file, resolve
 * the linked Obsidian file referenced by the block (i.e., the file inside the [[link]]).
 */
export const resolveLinkedTFileByBlockRef = async (
  app: App,
  canvasFile: TFile,
  blockRefId: string,
): Promise<TFile | null> => {
  try {
    if (!blockRefId) return null;

    const fileCache = app.metadataCache.getFileCache(canvasFile);
    if (!fileCache?.blocks?.[blockRefId]) return null;

    const block = fileCache.blocks[blockRefId];
    const fileContent = await app.vault.read(canvasFile);
    const blockContent = fileContent.substring(
      block.position.start.offset,
      block.position.end.offset,
    );

    const match = blockContent.match(/\[\[(.*?)\]\]/);
    if (!match?.[1]) return null;
    const rawLink = match[1].trim();
    // Drop alias part in [[path|alias]]
    const linkPath = rawLink.split("|")[0] ?? rawLink;
    return (
      app.metadataCache.getFirstLinkpathDest(linkPath, canvasFile.path) ?? null
    );
  } catch (error) {
    console.error("Error resolving linked TFile from blockRef:", error);
    return null;
  }
};

export const resolveLinkedFileFromSrc = async (
  app: App,
  canvasFile: TFile,
  src?: string,
): Promise<TFile | null> => {
  const blockRef = extractBlockRefId(src);
  if (!blockRef) return null;
  return resolveLinkedTFileByBlockRef(app, canvasFile, blockRef);
};

/**
 * Proxy class that handles Obsidian-specific file operations for the TLAssetStore
 */
class ObsidianMarkdownFileTLAssetStoreProxy {
  private resolvedAssetDataCache = new Map<BlockRefAssetId, AssetDataUrl>();
  private app: App;
  private file: TFile;

  /**
   * Safely set a cached Blob URL for an asset id, revoking any previous URL to avoid leaks
   */
  private setCachedUrl(blockRefAssetId: BlockRefAssetId, url: AssetDataUrl) {
    const previousUrl = this.resolvedAssetDataCache.get(blockRefAssetId);
    if (previousUrl && previousUrl !== url) {
      try {
        URL.revokeObjectURL(previousUrl);
      } catch (err) {
        console.warn("Failed to revoke previous object URL", err);
      }
    }
    this.resolvedAssetDataCache.set(blockRefAssetId, url);
  }

  constructor(options: AssetStoreOptions) {
    this.app = options.app;
    this.file = options.file;
  }

  storeAsset = async (
    _asset: TLAsset,
    file: File,
  ): Promise<BlockRefAssetId> => {
    const blockRefId = crypto.randomUUID();

    const objectName = `${blockRefId}-${file.name}`.replace(/\W/g, "-");
    const ext = file.type.split("/").at(1);
    const fileName = !ext ? objectName : `${objectName}.${ext}`;

    // TODO: in the future, get this from the user's settings
    let attachmentFolder = this.app.vault.getFolderByPath("attachments");
    if (!attachmentFolder) {
      attachmentFolder = await this.app.vault.createFolder("attachments");
    }
    const filePath = `${attachmentFolder.path}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const assetFile = await this.app.vault.createBinary(filePath, arrayBuffer);

    const linkText = this.app.metadataCache.fileToLinktext(
      assetFile,
      this.file.path,
    );
    const internalLink = `[[${linkText}]]`;
    const linkBlock = `${internalLink}\n^${blockRefId}`;

    await this.addToTopOfFile(linkBlock);

    const assetDataUri = URL.createObjectURL(file);
    const assetId = `${ASSET_PREFIX}${blockRefId}` as BlockRefAssetId;
    this.setCachedUrl(assetId, assetDataUri);

    return assetId;
  };

  getCached = async (
    blockRefAssetId: BlockRefAssetId,
  ): Promise<AssetDataUrl | null> => {
    try {
      // Check cache first
      const cached = this.resolvedAssetDataCache.get(blockRefAssetId);
      if (cached) return cached;

      // Load and cache if needed
      const assetData = await this.getAssetData(blockRefAssetId);
      if (!assetData) return null;

      const uri = URL.createObjectURL(new Blob([assetData]));
      this.setCachedUrl(blockRefAssetId, uri);
      return uri;
    } catch (error) {
      console.error("Error getting cached asset:", error);
      return null;
    }
  };

  dispose = () => {
    for (const url of this.resolvedAssetDataCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.resolvedAssetDataCache.clear();
  };

  private addToTopOfFile = async (content: string) => {
    await this.app.vault.process(this.file, (data: string) => {
      const fileCache = this.app.metadataCache.getFileCache(this.file);
      const { start, end } = fileCache?.frontmatterPosition ?? {
        start: { offset: 0 },
        end: { offset: 0 },
      };

      const frontmatter = data.slice(start.offset, end.offset);
      const rest = data.slice(end.offset);
      return `${frontmatter}\n${content}\n${rest}`;
    });
  };

  private getAssetData = async (
    blockRefAssetId: BlockRefAssetId,
  ): Promise<ArrayBuffer | null> => {
    try {
      const blockRef = extractBlockRefId(blockRefAssetId);
      if (!blockRef) return null;

      const linkedFile = await resolveLinkedTFileByBlockRef(
        this.app,
        this.file,
        blockRef,
      );
      if (!linkedFile) return null;
      // TODO: handle other file types too
      return await this.app.vault.readBinary(linkedFile);
    } catch (error) {
      console.error("Error getting asset data:", error);
      return null;
    }
  };
}

/**
 * TLAssetStore implementation for Obsidian
 */
export class ObsidianTLAssetStore implements Required<TLAssetStore> {
  private proxy: ObsidianMarkdownFileTLAssetStoreProxy;

  constructor(
    public readonly persistenceKey: string,
    options: AssetStoreOptions,
  ) {
    this.proxy = new ObsidianMarkdownFileTLAssetStoreProxy(options);
  }

  upload = async (
    asset: TLAsset,
    file: File,
  ): Promise<{ src: string; meta?: JsonObject }> => {
    try {
      const blockRefAssetId = await this.proxy.storeAsset(asset, file);
      return {
        src: `asset:${blockRefAssetId}`,
      };
    } catch (error) {
      console.error("Error uploading asset:", error);
      throw error;
    }
  };

  resolve = async (
    asset: TLAsset,
    _ctx: TLAssetContext,
  ): Promise<string | null> => {
    try {
      const assetSrc = asset.props.src;
      if (!assetSrc?.startsWith("asset:")) return assetSrc ?? null;

      const assetId = assetSrc.split(":")[1] as BlockRefAssetId;
      if (!assetId) return null;
      return await this.proxy.getCached(assetId);
    } catch (error) {
      console.error("Error resolving asset:", error);
      return null;
    }
  };

  remove = async (_assetIds: TLAssetId[]): Promise<void> => {
    // No-op for now as we don't want to delete files from the vault
    // The files will remain in the vault and can be managed by the user
  };

  dispose = () => {
    this.proxy.dispose();
  };
}