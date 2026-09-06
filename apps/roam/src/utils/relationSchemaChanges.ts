import { useEffect, useState } from "react";

let revision = 0;
const listeners = new Set<() => void>();
const deletedSchemaIds = new Set<string>();

export const subscribeToRelationSchemaChanges = (
  listener: () => void,
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const notifyRelationSchemaChange = (): void => {
  revision += 1;
  listeners.forEach((listener) => listener());
};

export const markRelationSchemaDeleted = (uid: string): void => {
  // Mounted canvases retain schema metadata to render their existing shapes.
  deletedSchemaIds.add(uid);
  notifyRelationSchemaChange();
};

export const isRelationSchemaDeleted = (uid: string): boolean =>
  deletedSchemaIds.has(uid);

export const useRelationSchemaRevision = (): number => {
  const [currentRevision, setCurrentRevision] = useState(revision);
  useEffect(() => {
    const update = (): void => setCurrentRevision(revision);
    const unsubscribe = subscribeToRelationSchemaChanges(update);
    update();
    return unsubscribe;
  }, []);
  return currentRevision;
};
