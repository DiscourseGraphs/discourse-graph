// Store construction for the static frame snapshot renderer. This must be
// byte-for-byte the recipe the live mount uses (useRoamStore's
// createCanvasStore + loadSnapshot): same default+custom utils, same
// migration sequences, so legacy pre-migration records upgrade during load
// exactly as they do when the live embed mounts, and the snapshot renders
// the same data the editor would show.
//
// Kept tldraw-only (no Roam imports) so unit tests can exercise the exact
// recipe in a node environment.
import {
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
  loadSnapshot,
  MigrationSequence,
  TLAnyBindingUtilConstructor,
  TLAnyShapeUtilConstructor,
  TLStore,
  TLStoreSnapshot,
} from "tldraw";

export const buildFrameExportStore = ({
  snapshot,
  migrations,
  customShapeUtils,
  customBindingUtils,
}: {
  snapshot: TLStoreSnapshot;
  migrations: MigrationSequence[];
  customShapeUtils: readonly TLAnyShapeUtilConstructor[];
  customBindingUtils: readonly TLAnyBindingUtilConstructor[];
}): TLStore => {
  const store = createTLStore({
    migrations,
    shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
    bindingUtils: [...defaultBindingUtils, ...customBindingUtils],
  });
  loadSnapshot(store, snapshot);
  return store;
};
