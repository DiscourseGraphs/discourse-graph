import { NODE_CONFIG_PAGE_TITLE } from "~/settings/configPages";

export const isDiscourseNodeConfigPage = (title: string) =>
  title.startsWith(NODE_CONFIG_PAGE_TITLE);
