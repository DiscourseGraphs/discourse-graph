let discourseNodeTypeCacheVersion = 0;

export const invalidateDiscourseNodeTypeCaches = (): void => {
  discourseNodeTypeCacheVersion += 1;
};

export const getDiscourseNodeTypeCacheVersion = (): number =>
  discourseNodeTypeCacheVersion;
