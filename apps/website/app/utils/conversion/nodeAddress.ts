import type { Enums } from "@repo/database/dbTypes";
import {
  ridToSpaceUriAndLocalId,
  spaceUriAndLocalIdToRid,
} from "@repo/database/lib/rid";

type Platform = Enums<"Platform">;

// The public address of a node is `<platform segment>/<space key>/<local ID>`.
// Only the server builds or parses it; clients pass RIDs whole.
export type NodePath = {
  platform: Platform;
  spaceKey: string;
  localId: string;
};

const ROAM_SPACE_URL_PREFIX = "https://roamresearch.com/#/app/";
const OBSIDIAN_SPACE_URL_PREFIX = "obsidian:";

const PLATFORM_SEGMENTS: Record<Platform, string> = {
  Roam: "roam",
  Obsidian: "obsidian",
};

const SPACE_URL_PREFIXES: Record<Platform, string> = {
  Roam: ROAM_SPACE_URL_PREFIX,
  Obsidian: OBSIDIAN_SPACE_URL_PREFIX,
};

export const platformFromSegment = (segment: string): Platform | undefined =>
  (Object.keys(PLATFORM_SEGMENTS) as Platform[]).find(
    (platform) => PLATFORM_SEGMENTS[platform] === segment,
  );

export const spaceKeyFromSpaceUrl = ({
  platform,
  spaceUrl,
}: {
  platform: Platform;
  spaceUrl: string;
}): string | undefined => {
  const prefix = SPACE_URL_PREFIXES[platform];
  if (!spaceUrl.startsWith(prefix)) return undefined;
  const spaceKey = spaceUrl.substring(prefix.length);
  return spaceKey.length > 0 && !spaceKey.includes("/") ? spaceKey : undefined;
};

export const spaceUrlFromSpaceKey = ({
  platform,
  spaceKey,
}: {
  platform: Platform;
  spaceKey: string;
}): string => SPACE_URL_PREFIXES[platform] + spaceKey;

const platformOfSpaceUrl = (spaceUrl: string): Platform | undefined =>
  (Object.keys(SPACE_URL_PREFIXES) as Platform[]).find((platform) =>
    spaceUrl.startsWith(SPACE_URL_PREFIXES[platform]),
  );

export const nodePathFromRid = (rid: string): NodePath | undefined => {
  const { spaceUri, sourceLocalId } = ridToSpaceUriAndLocalId(rid);
  const platform = platformOfSpaceUrl(spaceUri);
  if (!platform || !sourceLocalId) return undefined;
  const spaceKey = spaceKeyFromSpaceUrl({ platform, spaceUrl: spaceUri });
  if (!spaceKey) return undefined;
  return { platform, spaceKey, localId: sourceLocalId };
};

// Node types use the `schema` RID subtype, other nodes `note`, as the plugins do.
// The subtype only shows in non-URL RIDs (Obsidian).
export const ridFromNodePath = ({
  nodePath,
  isSchema,
}: {
  nodePath: NodePath;
  isSchema: boolean;
}): string =>
  spaceUriAndLocalIdToRid(
    spaceUrlFromSpaceKey(nodePath),
    nodePath.localId,
    isSchema ? "schema" : "note",
  );

const pathSuffix = ({ platform, spaceKey, localId }: NodePath): string =>
  [PLATFORM_SEGMENTS[platform], spaceKey, localId]
    .map(encodeURIComponent)
    .join("/");

export const spacePathSuffix = ({
  platform,
  spaceKey,
}: Omit<NodePath, "localId">): string =>
  [PLATFORM_SEGMENTS[platform], spaceKey].map(encodeURIComponent).join("/");

// The document describing the node, served as JSON-LD.
export const nodeDataUrl = ({
  origin,
  nodePath,
}: {
  origin: string;
  nodePath: NodePath;
}): string => `${origin}/api/data/${pathSuffix(nodePath)}`;

// The node itself, as distinct from the document that describes it.
export const nodeIri = (args: { origin: string; nodePath: NodePath }): string =>
  `${nodeDataUrl(args)}#it`;

// The same node as a web page.
export const nodeContentUrl = ({
  origin,
  nodePath,
}: {
  origin: string;
  nodePath: NodePath;
}): string => `${origin}/api/content/${pathSuffix(nodePath)}`;

export const spaceDataUrl = ({
  origin,
  platform,
  spaceKey,
}: {
  origin: string;
  platform: Platform;
  spaceKey: string;
}): string => `${origin}/api/data/${spacePathSuffix({ platform, spaceKey })}`;

// The node's web view on this site, as a site-relative path.
export const nodeDisplayPath = (nodePath: NodePath): string =>
  `/display/${pathSuffix(nodePath)}`;

// The space's web view on this site, as a site-relative path.
export const spaceDisplayPath = (
  spacePath: Omit<NodePath, "localId">,
): string => `/display/${spacePathSuffix(spacePath)}`;
