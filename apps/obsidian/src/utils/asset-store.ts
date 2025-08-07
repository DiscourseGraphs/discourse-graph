import { App, TFile } from "obsidian";
import { TLAsset, TLAssetStore, TLAssetId, TLAssetContext } from "tldraw";
import { JsonObject } from "@tldraw/utils";

const ASSET_PREFIX = "obsidian.blockref.";
type BlockRefAssetId = `${typeof ASSET_PREFIX}${string}`;
type AssetDataUrl = string;

interface AssetStoreOptions {
  app: App;
  file: TFile;
}

/**
 * Proxy class that handles Obsidian-specific file operations for the TLDraw asset store
 */
class ObsidianMarkdownFileTLAssetStoreProxy {
  #resolvedAssetDataCache = new Map<BlockRefAssetId, AssetDataUrl>();
  #app: App;
  #file: TFile;

  constructor(options: AssetStoreOptions) {
    this.#app = options.app;
    this.#file = options.file;
  }

  async storeAsset(asset: TLAsset, file: File): Promise<BlockRefAssetId> {
    // Generate unique block reference ID
    const blockRefId = crypto.randomUUID();

    // Create sanitized file name
    const objectName = `${blockRefId}-${file.name}`.replace(/\W/g, "-");
    const ext = file.type.split("/").at(1);
    const fileName = !ext ? objectName : `${objectName}.${ext}`;

    console.log("fileName", fileName);

    // Get the attachment folder path
    let attachmentFolder = this.#app.vault.getFolderByPath("attachments");
    if (!attachmentFolder) {
      attachmentFolder = await this.#app.vault.createFolder("attachments");
    }
    const filePath = `${attachmentFolder.path}/${fileName}`;

    // Store file in vault
    const arrayBuffer = await file.arrayBuffer();
    console.log("arrayBuffer", arrayBuffer);
    const assetFile = await this.#app.vault.createBinary(filePath, arrayBuffer);
    console.log("assetFile", assetFile);

    // Create markdown link and block reference
    const internalLink = this.#app.fileManager.generateMarkdownLink(
      assetFile,
      this.#file.path,
    );
    const linkBlock = `${internalLink}\n^${blockRefId}`;

    await this.#addToTopOfFile(linkBlock);

    const assetDataUri = URL.createObjectURL(file);
    const assetId = `${ASSET_PREFIX}${blockRefId}` as BlockRefAssetId;
    this.#resolvedAssetDataCache.set(assetId, assetDataUri);

    return assetId;
  }

  async getCached(
    blockRefAssetId: BlockRefAssetId,
  ): Promise<AssetDataUrl | null> {
    try {
      // Check cache first
      const cached = this.#resolvedAssetDataCache.get(blockRefAssetId);
      if (cached) return cached;

      // Load and cache if needed
      const assetData = await this.#getAssetData(blockRefAssetId);
      if (!assetData) return null;

      const uri = URL.createObjectURL(new Blob([assetData]));
      this.#resolvedAssetDataCache.set(blockRefAssetId, uri);
      return uri;
    } catch (error) {
      console.error("Error getting cached asset:", error);
      return null;
    }
  }

  dispose() {
    // Revoke all cached URLs
    for (const url of this.#resolvedAssetDataCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.#resolvedAssetDataCache.clear();
  }

  // Private helper methods
  async #addToTopOfFile(content: string) {
    await this.#app.vault.process(this.#file, (data: string) => {
      const fileCache = this.#app.metadataCache.getFileCache(this.#file);
      const { start, end } = fileCache?.frontmatterPosition ?? {
        start: { offset: 0 },
        end: { offset: 0 },
      };

      const frontmatter = data.slice(start.offset, end.offset);
      const rest = data.slice(end.offset);
      return `${frontmatter}\n${content}\n${rest}`;
    });
  }

  async #getAssetData(
    blockRefAssetId: BlockRefAssetId,
  ): Promise<ArrayBuffer | null> {
    try {
      const blockRef = blockRefAssetId.slice(ASSET_PREFIX.length);
      if (!blockRef) return null;

      // Get block from metadata cache
      const fileCache = this.#app.metadataCache.getFileCache(this.#file);
      if (!fileCache?.blocks?.[blockRef]) return null;

      const block = fileCache.blocks[blockRef];
      const fileContent = await this.#app.vault.read(this.#file);
      const blockContent = fileContent.substring(
        block.position.start.offset,
        block.position.end.offset,
      );

      // Extract link from block content
      const match = blockContent.match(/\[\[(.*?)\]\]/);
      if (!match?.[1]) return null;

      // Resolve link to actual file
      const linkPath = match[1];
      const linkedFile = this.#app.metadataCache.getFirstLinkpathDest(
        linkPath,
        this.#file.path,
      );
      if (!linkedFile) return null;

      // Read the binary data
      return await this.#app.vault.readBinary(linkedFile);
    } catch (error) {
      console.error("Error getting asset data:", error);
      return null;
    }
  }
}

/**
 * TLDraw asset store implementation for Obsidian
 */
export class ObsidianTLAssetStore implements Required<TLAssetStore> {
  #proxy: ObsidianMarkdownFileTLAssetStoreProxy;

  constructor(
    public readonly persistenceKey: string,
    options: AssetStoreOptions,
  ) {
    this.#proxy = new ObsidianMarkdownFileTLAssetStoreProxy(options);
  }

  async upload(
    asset: TLAsset,
    file: File,
  ): Promise<{ src: string; meta?: JsonObject }> {
    try {
      const blockRefAssetId = await this.#proxy.storeAsset(asset, file);
      return {
        src: `asset:${blockRefAssetId}`,
      };
    } catch (error) {
      console.error("Error uploading asset:", error);
      throw error;
    }
  }

  async resolve(asset: TLAsset, ctx: TLAssetContext): Promise<string | null> {
    try {
      const assetSrc = asset.props.src;
      if (!assetSrc?.startsWith("asset:")) return assetSrc ?? null;

      const assetId = assetSrc.split(":")[1] as BlockRefAssetId;
      if (!assetId) return null;

      return await this.#proxy.getCached(assetId);
    } catch (error) {
      console.error("Error resolving asset:", error);
      return null;
    }
  }

  async remove(assetIds: TLAssetId[]): Promise<void> {
    // No-op for now as we don't want to delete files from the vault
    // The files will remain in the vault and can be managed by the user
  }

  dispose() {
    this.#proxy.dispose();
  }
}
