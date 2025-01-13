import { NODE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";

export const isDiscourseNodeConfigPage = (title: string) =>
  title.startsWith(NODE_CONFIG_PAGE_TITLE);
