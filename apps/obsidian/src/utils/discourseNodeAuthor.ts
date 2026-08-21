import { App, TFile } from "obsidian";
import { useEffect, useState } from "react";
import type DiscourseGraphPlugin from "~/index";
import type { DiscourseNodeCandidate } from "~/services/QueryEngine";
import { fetchUserNames } from "~/utils/importNodes";
import { getLoggedInClient } from "~/utils/supabaseContext";

/** Single source for a note's author name. Obsidian exposes no Sync user API, so names come from `authorId` frontmatter. */

export const LOCAL_AUTHOR_NAME = "You";
export const UNRESOLVED_AUTHOR_NAME = "Unknown";

/** Frontmatter is untyped, so the raw value is narrowed by each caller. */
const getFrontmatterAuthorId = (app: App, file: TFile): unknown => {
  // Annotated rather than asserted: `FrontMatterCache` indexes to `any`, so the
  // cast was a no-op, and this keeps the read typed as `unknown`.
  const frontmatter: Record<string, unknown> | undefined =
    app.metadataCache.getFileCache(file)?.frontmatter;
  return frontmatter?.authorId;
};

/** "You" only when there is no `authorId`; a present but unresolvable id stays "Unknown". */
export const resolveAuthorName = ({
  app,
  file,
  userNames,
}: {
  app: App;
  file: TFile;
  userNames: Record<number, string>;
}): string => {
  const authorId = getFrontmatterAuthorId(app, file);
  if (authorId === undefined || authorId === null) return LOCAL_AUTHOR_NAME;
  if (typeof authorId !== "number") return UNRESOLVED_AUTHOR_NAME;
  return userNames[authorId] ?? UNRESOLVED_AUTHOR_NAME;
};

/** A name that identifies no one, kept out of the alphabetical run. */
export const isUnattributedAuthorName = (authorName: string): boolean =>
  authorName === UNRESOLVED_AUTHOR_NAME;

/** Author sort needs a name for every candidate, not just the previewed one. */
export const buildAuthorNameByPath = ({
  app,
  files,
  userNames,
}: {
  app: App;
  files: TFile[];
  userNames: Record<number, string>;
}): Map<string, string> => {
  const byPath = new Map<string, string>();
  files.forEach((file) => {
    byPath.set(file.path, resolveAuthorName({ app, file, userNames }));
  });
  return byPath;
};

/** One query returns every person, so this refreshes once per open when a name is missing. */
export const useAuthorNames = ({
  app,
  plugin,
  candidates,
}: {
  app: App;
  plugin: DiscourseGraphPlugin;
  /** Null until the candidate load finishes; nothing to resolve before then. */
  candidates: DiscourseNodeCandidate[] | null;
}): Record<number, string> => {
  const [userNames, setUserNames] = useState(plugin.settings.userNames ?? {});

  useEffect(() => {
    if (!candidates) return;
    if (!plugin.settings.syncModeEnabled) return;

    const isMissingName = (candidate: DiscourseNodeCandidate): boolean => {
      const authorId = getFrontmatterAuthorId(app, candidate.file);
      return (
        typeof authorId === "number" && !plugin.settings.userNames?.[authorId]
      );
    };
    if (!candidates.some(isMissingName)) return;

    let cancelled = false;
    void (async () => {
      const client = await getLoggedInClient(plugin);
      if (!client || cancelled) return;
      await fetchUserNames(plugin, client);
      if (!cancelled) setUserNames(plugin.settings.userNames ?? {});
    })();
    return () => {
      cancelled = true;
    };
  }, [app, plugin, candidates]);

  return userNames;
};
