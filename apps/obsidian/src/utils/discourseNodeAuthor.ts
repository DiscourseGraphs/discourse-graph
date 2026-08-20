import { App, TFile } from "obsidian";
import { useEffect, useState } from "react";
import type DiscourseGraphPlugin from "~/index";
import type { DiscourseNodeCandidate } from "~/services/QueryEngine";
import { fetchUserNames } from "~/utils/importNodes";
import { getLoggedInClient } from "~/utils/supabaseContext";

/**
 * Author resolution for discourse node search. This is the single place that
 * turns a note into a display name, so the preview header and the author sort
 * can never disagree about who wrote something.
 *
 * Known limitation: Obsidian Sync is not a source here. The 1.8.7 typings
 * expose no sync, user, or collaborator API, so per-file attribution from Sync
 * cannot be read by a plugin. Names therefore come from the `authorId`
 * frontmatter written by the importer, resolved against the ids cached in
 * settings.
 */

export const LOCAL_AUTHOR_NAME = "You";
export const UNRESOLVED_AUTHOR_NAME = "Unknown";

/** Frontmatter is untyped, so the raw value is narrowed by each caller. */
const getFrontmatterAuthorId = (app: App, file: TFile): unknown => {
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter as
    | Record<string, unknown>
    | undefined;
  return frontmatter?.authorId;
};

/**
 * "You" belongs only to a note with no `authorId` at all — every note in an
 * unsynced vault. An id that is present but unresolvable stays "Unknown" rather
 * than claiming local authorship. `useAuthorNames` has already cached the
 * names, so this stays synchronous.
 */
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

/**
 * A name that identifies no one. Sorting keeps these out of the alphabetical
 * run so an unreadable id never lands between two real authors.
 */
export const isUnattributedAuthorName = (authorName: string): boolean =>
  authorName === UNRESOLVED_AUTHOR_NAME;

/**
 * Author sort needs a name for every candidate, not just the previewed one, so
 * the whole list is resolved up front and keyed by path.
 */
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

/**
 * `fetchUserNames` returns every person in the vault's spaces in one query, so
 * this refreshes once per open when a name is missing rather than querying per
 * author.
 */
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
