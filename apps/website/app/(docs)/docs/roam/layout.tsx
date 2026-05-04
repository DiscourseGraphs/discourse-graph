import { getPageMap } from "nextra/page-map";
import DocsThemeLayout from "../_components/DocsThemeLayout";
import "../../../(nextra)/nextra-css.css";
import "nextra-theme-docs/style-prefixed.css";

type RoamDocsLayoutProps = {
  children: React.ReactNode;
};

const RoamDocsLayout = async ({
  children,
}: RoamDocsLayoutProps): Promise<React.ReactElement> => {
  const pageMap = await getPageMap("/docs/roam");

  return (
    <DocsThemeLayout pageMap={pageMap} searchScope="roam">
      {children}
    </DocsThemeLayout>
  );
};

export default RoamDocsLayout;
