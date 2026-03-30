import { getPageMap } from "nextra/page-map";
import DocsThemeLayout from "../_components/DocsThemeLayout";
import "../../../(nextra)/nextra-css.css";
import "nextra-theme-docs/style-prefixed.css";

type DocsLandingLayoutProps = {
  children: React.ReactNode;
};

const DocsLandingLayout = async ({
  children,
}: DocsLandingLayoutProps): Promise<React.ReactElement> => {
  const pageMap = await getPageMap("/docs");

  return <DocsThemeLayout pageMap={pageMap}>{children}</DocsThemeLayout>;
};

export default DocsLandingLayout;
