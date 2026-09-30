const getFirstAvailableShortcut = (
  label: string,
  takenShortcuts: Set<string>,
): string => {
  const taken = new Set([...takenShortcuts].map((s) => s.toUpperCase()));
  for (const char of label.toUpperCase()) {
    if (/[\p{L}\p{N}]/u.test(char) && !taken.has(char)) {
      return char;
    }
  }
  return "";
};

export default getFirstAvailableShortcut;
