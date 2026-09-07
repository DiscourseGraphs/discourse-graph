import { getPageMap } from "nextra/page-map";
import type { PageMapItem } from "nextra";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import "./nextra-css.css";
import "nextra-theme-docs/style-prefixed.css";

type DocsNextraLayoutProps = {
  children: React.ReactNode;
};

const DOCS_ROUTES = new Set([
  "/nextra",
  "/nextra/getting-started",
  "/nextra/templates",
]);

const filterDocsPageMap = (pageMap: PageMapItem[]): PageMapItem[] =>
  pageMap.flatMap((item) => {
    if ("children" in item) {
      const children = filterDocsPageMap(item.children);

      if (!children.length && !DOCS_ROUTES.has(item.route)) {
        return [];
      }

      return [{ ...item, children }];
    }

    if ("route" in item && DOCS_ROUTES.has(item.route)) {
      return [item];
    }

    return [];
  });

const DocsNextraLayout = async ({
  children,
}: DocsNextraLayoutProps): Promise<React.ReactElement> => {
  const pageMap = filterDocsPageMap(await getPageMap("/nextra"));

  return (
    <div className="nextra-reset">
      <Layout
        editLink={null}
        feedback={{ content: null }}
        footer={
          <Footer>
            Apache 2.0 {new Date().getFullYear()} (c) Discourse Graphs.
          </Footer>
        }
        navbar={
          <Navbar
            logo={
              <span className="font-semibold tracking-tight">
                Discourse Graphs docs
              </span>
            }
            projectLink="https://github.com/DiscourseGraphs/discourse-graph"
          />
        }
        pageMap={pageMap}
        sidebar={{
          defaultMenuCollapseLevel: 1,
        }}
        toc={{
          backToTop: "Back to top",
        }}
      >
        {children}
      </Layout>
    </div>
  );
};

export default DocsNextraLayout;
