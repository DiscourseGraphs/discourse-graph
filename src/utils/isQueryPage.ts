import { OnloadArgs } from "roamjs-components/types";
import { getQueryPages } from "~/components/settings/QueryPagesPanel";

export const isQueryPage = ({
  title,
  onloadArgs,
}: {
  title: string;
  onloadArgs: OnloadArgs;
}): boolean => {
  const { extensionAPI } = onloadArgs;
  const queryPages = getQueryPages(extensionAPI);

  const matchesQueryPage = queryPages.some((queryPage) => {
    const escapedPattern = queryPage
      .replace(/\*/g, ".*")
      .replace(/([()])/g, "\\$1");
    const regex = new RegExp(`^${escapedPattern}$`);
    return regex.test(title);
  });

  return matchesQueryPage;
};
