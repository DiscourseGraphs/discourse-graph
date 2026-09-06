// Keep Roam's React functions and dispatcher, but isolate our compatibility hook
// from extensions that replace window.React.useSyncExternalStore during startup.
module.exports = { ...window.React, useSyncExternalStore: undefined };

// Publish the facade before requiring the shim: its React import points back here.
// Clearing the hook above makes it select our bundled implementation even when
// another extension has already installed a global shim.
module.exports.useSyncExternalStore =
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS preserves the shim's circular React import.
  require("use-sync-external-store/shim").useSyncExternalStore;
/* global module, require */
