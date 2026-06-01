export const intersection = <T>(set1: Set<T>, set2: Set<T>): Set<T> => {
  // @ts-expect-error - Set.intersection is ES2025 feature
  if (set1.intersection) return set1.intersection(set2); // eslint-disable-line
  const r: Set<T> = new Set();
  for (const x of set1) {
    if (set2.has(x)) r.add(x);
  }
  return r;
};

export const difference = <T>(set1: Set<T>, set2: Set<T>): Set<T> => {
  // @ts-expect-error - Set.difference is ES2025 feature
  if (set1.difference) return set1.difference(set2); // eslint-disable-line
  const result = new Set(set1);
  if (set1.size <= set2.size)
    for (const e of set1) {
      if (set2.has(e)) result.delete(e);
    }
  else
    for (const e of set2) {
      if (result.has(e)) result.delete(e);
    }
  return result;
};
