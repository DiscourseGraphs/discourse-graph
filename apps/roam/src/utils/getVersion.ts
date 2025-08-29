// Version is injected during build process
declare global {
  interface Window {
    __DISCOURSE_GRAPH_VERSION__?: string;
    __DISCOURSE_GRAPH_BUILD_DATE__?: string;
  }
}

export const getVersionWithDate = (): {
  version: string;
  buildDate: string;
} => {
  if (typeof window === "undefined") {
    return {
      version: "-",
      buildDate: "-",
    };
  }

  return {
    version: window.__DISCOURSE_GRAPH_VERSION__ || "-",
    buildDate: window.__DISCOURSE_GRAPH_BUILD_DATE__ || "-",
  };
};
