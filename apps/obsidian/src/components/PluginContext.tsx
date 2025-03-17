import { createContext, useContext, ReactNode } from "react";
import type DiscourseGraphPlugin from "~/index";

export const PluginContext = createContext<DiscourseGraphPlugin | undefined>(
  undefined,
);

export const usePlugin = (): DiscourseGraphPlugin => {
  const plugin = useContext(PluginContext);
  if (!plugin) {
    throw new Error("usePlugin must be used within a PluginProvider");
  }
  return plugin;
};

export const PluginProvider = ({
  plugin,
  children,
}: {
  plugin: DiscourseGraphPlugin;
  children: ReactNode;
}) => {
  return (
    <PluginContext.Provider value={plugin}>{children}</PluginContext.Provider>
  );
};
