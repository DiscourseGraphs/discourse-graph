import type { PageMapItem } from "nextra";
import { Search } from "nextra/components";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Logo } from "~/components/Logo";

type DocsSearchScope = "roam" | "obsidian";

type DocsThemeLayoutProps = {
  children: React.ReactNode;
  hideSearch?: boolean;
  pageMap: PageMapItem[];
  searchScope?: DocsSearchScope;
};

const SEARCH_PLACEHOLDERS: Record<DocsSearchScope, string> = {
  obsidian: "Search Obsidian docs...",
  roam: "Search Roam docs...",
};

const renderSearch = ({
  hideSearch,
  searchScope,
}: Pick<DocsThemeLayoutProps, "hideSearch" | "searchScope">):
  | React.ReactElement
  | null
  | undefined => {
  if (hideSearch) {
    return null;
  }

  if (!searchScope) {
    return undefined;
  }

  return (
    <Search
      placeholder={SEARCH_PLACEHOLDERS[searchScope]}
      searchOptions={{
        filters: {
          platform: [searchScope],
        },
      }}
    />
  );
};

const DocsThemeLayout = ({
  children,
  hideSearch,
  pageMap,
  searchScope,
}: DocsThemeLayoutProps): React.ReactElement => {
  const search = renderSearch({ hideSearch, searchScope });

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
        search={search}
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
