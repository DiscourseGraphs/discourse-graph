import type { PageMapItem } from "nextra";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Logo } from "~/components/Logo";

type DocsThemeLayoutProps = {
  children: React.ReactNode;
  pageMap: PageMapItem[];
};

const DocsThemeLayout = ({
  children,
  pageMap,
}: DocsThemeLayoutProps): React.ReactElement => {
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
            logo={<Logo linked={false} textClassName="text-inherit" />}
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

export default DocsThemeLayout;
