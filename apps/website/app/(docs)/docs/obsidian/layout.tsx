import { getPageMap } from "nextra/page-map";
import DocsThemeLayout from "../_components/DocsThemeLayout";
import "../../../(nextra)/nextra-css.css";
import "nextra-theme-docs/style-prefixed.css";

type ObsidianDocsLayoutProps = {
  children: React.ReactNode;
};

const ObsidianDocsLayout = async ({
  children,
}: ObsidianDocsLayoutProps): Promise<React.ReactElement> => {
  const pageMap = await getPageMap("/docs/obsidian");

  return (
    <DocsThemeLayout pageMap={pageMap} searchScope="obsidian">
      {children}
    </DocsThemeLayout>
  );
};

export default ObsidianDocsLayout;
