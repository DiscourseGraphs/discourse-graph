import { getQueryPages } from "~/components/settings/utils/accessors";

export const isQueryPage = ({ title }: { title: string }): boolean => {
  const queryPages = getQueryPages();

  const matchesQueryPage = queryPages.some((queryPage) => {
    const escapedPattern = queryPage
      .replace(/\*/g, ".*")
      .replace(/([()])/g, "\\$1");
    const regex = new RegExp(`^${escapedPattern}$`);
    return regex.test(title);
  });

  return matchesQueryPage;
};
