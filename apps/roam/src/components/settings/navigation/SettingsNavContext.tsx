import React, { createContext, useContext, useMemo } from "react";
import {
  depthOf,
  segmentsOf,
  type SettingsNavAction,
  type SettingsPath,
} from "../utils/settingsNavigation";

export type SettingsNavValue = {
  path: SettingsPath;
  depth: number;
  segments: readonly string[];
  push: (segment: string) => void;
  pop: () => void;
  goToDepth: (depth: number) => void;
};

const SettingsNavContext = createContext<SettingsNavValue | null>(null);

export const SettingsNavProvider = ({
  path,
  dispatch,
  children,
}: {
  path: SettingsPath;
  dispatch: React.Dispatch<SettingsNavAction>;
  children: React.ReactNode;
}): JSX.Element => {
  const value = useMemo<SettingsNavValue>(
    () => ({
      path,
      depth: depthOf(path),
      segments: segmentsOf(path),
      push: (segment) => dispatch({ type: "push", segment }),
      pop: () => dispatch({ type: "pop" }),
      goToDepth: (depth) => dispatch({ type: "truncate", depth }),
    }),
    [path, dispatch],
  );
  return (
    <SettingsNavContext.Provider value={value}>
      {children}
    </SettingsNavContext.Provider>
  );
};

export const useSettingsNav = (): SettingsNavValue => {
  const context = useContext(SettingsNavContext);
  if (!context) {
    throw new Error("useSettingsNav must be used within a SettingsNavProvider");
  }
  return context;
};
