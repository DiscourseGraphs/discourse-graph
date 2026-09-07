// Capture Roam's React exports once so later extension assignments cannot change
// the hook implementation used by an already mounted DG component.
module.exports = { ...window.React };
/* global module */
