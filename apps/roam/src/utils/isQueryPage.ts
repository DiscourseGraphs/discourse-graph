import { getQueryPages } from "~/components/settings/QueryPagesPanel";
import type { SettingsSnapshot } from "~/components/settings/utils/accessors";

export const isQueryPage = ({
  title,
  snapshot,
}: {
  title: string;
  snapshot?: SettingsSnapshot;
}): boolean => {
  const queryPages = getQueryPages(snapshot);

  const matchesQueryPage = queryPages.some((queryPage) => {
    const escapedPattern = queryPage
      .replace(/\*/g, ".*")
      .replace(/([()])/g, "\\$1");
    const regex = new RegExp(`^${escapedPattern}$`);
    return regex.test(title);
  });

  return matchesQueryPage;
};
