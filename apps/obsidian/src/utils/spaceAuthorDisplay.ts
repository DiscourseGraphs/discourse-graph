import type { Enums } from "@repo/database/dbTypes";

/**
 * Assumes an Obsidian vault is single-author; one with several names only the first.
 * A Roam node's name is the creator of its page, not everyone who wrote it.
 */
export const authorNamePlacement = (
  spacePlatform: Enums<"Platform">,
): "header" | "nodes" => (spacePlatform === "Obsidian" ? "header" : "nodes");
