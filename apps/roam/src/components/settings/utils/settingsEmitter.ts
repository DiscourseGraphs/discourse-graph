type SettingChangeCallback = (newValue: unknown, oldValue: unknown) => void;

const listeners = new Map<string, Set<SettingChangeCallback>>();

export const onSettingChange = (
  key: string,
  callback: SettingChangeCallback,
): (() => void) => {
  if (!listeners.has(key)) {
    listeners.set(key, new Set());
  }
  listeners.get(key)!.add(callback);
  return () => {
    listeners.get(key)?.delete(callback);
  };
};

export const emitSettingChange = (
  key: string,
  newValue: unknown,
  oldValue: unknown,
): void => {
  listeners.get(key)?.forEach((cb) => cb(newValue, oldValue));
};
