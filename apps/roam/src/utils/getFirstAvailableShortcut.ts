const getFirstAvailableShortcut = (
  label: string,
  takenShortcuts: Set<string>,
): string => {
  for (const char of label.toUpperCase()) {
    if (/[\p{L}\p{N}]/u.test(char) && !takenShortcuts.has(char)) {
      return char;
    }
  }
  return "";
};

export default getFirstAvailableShortcut;
