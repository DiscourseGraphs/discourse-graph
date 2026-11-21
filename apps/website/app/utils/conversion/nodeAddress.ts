import type { Enums } from "@repo/database/dbTypes";
import { ridToSpaceUriAndLocalId } from "@repo/database/lib/rid";

type Platform = Enums<"Platform">;

export type NodePath = {
  platform: Platform;
  spaceKey: string;
  localId: string;
};

const ROAM_SPACE_URL_PREFIX = "https://roamresearch.com/#/app/";
const OBSIDIAN_SPACE_URL_PREFIX = "obsidian:";

const SPACE_URL_PREFIXES: Record<Platform, string> = {
  Roam: ROAM_SPACE_URL_PREFIX,
  Obsidian: OBSIDIAN_SPACE_URL_PREFIX,
};

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
