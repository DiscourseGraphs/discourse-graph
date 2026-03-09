/**
 * Single access point for Roam's render React components (Block, Page, BlockString).
 * Use these instead of reading window.roamAlphaAPI.ui.react in each component.
 */
const { Block: RenderRoamBlock, Page: RenderRoamPage, BlockString: RenderRoamBlockString } =
  window.roamAlphaAPI.ui.react;

export { RenderRoamBlock, RenderRoamPage, RenderRoamBlockString };
