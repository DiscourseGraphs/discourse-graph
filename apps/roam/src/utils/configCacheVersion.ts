let configCacheVersion = 0;

export const getConfigCacheVersion = (): number => {
  return configCacheVersion;
};

export const bumpConfigCacheVersion = (): void => {
  configCacheVersion += 1;
};
