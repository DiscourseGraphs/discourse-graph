import { getSupabaseContext } from "./supabaseContext";
import type DiscourseGraphPlugin from "~/index";

export const initializeSupabaseSync = async (
  plugin: DiscourseGraphPlugin,
): Promise<void> => {
  const context = await getSupabaseContext(plugin);
  if (!context) {
    throw new Error("Failed to initialize Supabase sync: could not create context");
  }
  console.log("Supabase sync initialized successfully", {
    spaceId: context.spaceId,
    userId: context.userId,
  });
};
