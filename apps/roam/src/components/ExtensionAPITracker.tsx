import React, { useContext, createContext } from "react";
import { OnloadArgs } from "roamjs-components/types";

const ExtensionAPIContext = createContext<OnloadArgs["extensionAPI"]>(
  {} as OnloadArgs["extensionAPI"],
);

export const ExtensionAPITracker = ({
  extensionAPI,
  children,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
  children: React.ReactNode;
}) => {
  return (
    <ExtensionAPIContext.Provider value={extensionAPI}>
      {children}
    </ExtensionAPIContext.Provider>
  );
};

export const useExtensionAPI = () => useContext(ExtensionAPIContext);
