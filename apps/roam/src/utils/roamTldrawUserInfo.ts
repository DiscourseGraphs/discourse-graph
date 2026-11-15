import type { TLPresenceUserInfo } from "tldraw";

const CURRENT_USER_PULL_PATTERN = "[*]";

const normalizeNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
};

const getCurrentRoamUserUid = (): string | undefined => {
  try {
    return normalizeNonEmptyString(window.roamAlphaAPI.user.uid());
  } catch {
    return undefined;
  }
};

const getCurrentRoamDisplayName = (userUid: string): string | undefined => {
  try {
    const currentUser = window.roamAlphaAPI.pull(CURRENT_USER_PULL_PATTERN, [
      ":user/uid",
      userUid,
    ]);

    return normalizeNonEmptyString(currentUser?.[":user/display-name"]);
  } catch {
    return undefined;
  }
};

export const getCurrentRoamTldrawUserInfo = ():
  | TLPresenceUserInfo
  | undefined => {
  const userUid = getCurrentRoamUserUid();
  if (!userUid) return undefined;

  const displayName = getCurrentRoamDisplayName(userUid);

  return {
    id: userUid,
    ...(displayName ? { name: displayName } : {}),
  };
};
