"use client";
/* eslint-disable @typescript-eslint/naming-convention */

import { useEffect, useMemo, useState } from "react";

type AdminShellProps = {
  oauthBaseUrl: string;
};

type DecapCmsConfig = Record<string, unknown>;
type DecapCmsCollection = Record<string, unknown>;
type DecapCmsField = Record<string, unknown>;
type DecapCmsFile = Record<string, unknown>;
type PreviewProps = {
  entry: {
    getIn?: (path: string[]) => string | undefined;
  };
  widgetFor: (fieldName: string) => unknown;
};
type CmsWindow = Window & {
  CMS?: {
    registerPreviewTemplate?: (name: string, reactComponent: unknown) => void;
  };
  CMS_MANUAL_INIT?: boolean;
  __decapCmsInitialized?: boolean;
  __decapPreviewTemplatesRegistered?: boolean;
  createClass?: (component: { render: () => unknown }) => unknown;
  h?: (
    type: string,
    props?: Record<string, unknown> | null,
    ...children: unknown[]
  ) => unknown;
  initCMS?: (options: { config: DecapCmsConfig }) => void;
};

type DocsCollectionConfig = {
  folder: string;
  label: string;
  mediaFolder: string;
  name: string;
  previewPath: string;
  publicFolder: string;
};

type LandingPageConfig = {
  file: string;
  label: string;
  name: string;
  previewPath: string;
};

const getCmsWindow = (): CmsWindow => window as CmsWindow;

const MDX_BODY_HINT =
  "This field stores raw MDX. Keep existing imports and Nextra components intact.";
const DOCS_BODY_HINT =
  "This field stores raw markdown. Use the Vercel preview deployment to confirm the rendered page.";
const PREVIEW_NOTICE =
  "Preview is approximate. Custom MDX and Nextra components do not render here yet.";

const PAGES_MEDIA_FOLDER = "apps/website/public/uploads/pages";
const PAGES_PUBLIC_FOLDER = "/uploads/pages";

const DOCS_COLLECTIONS: DocsCollectionConfig[] = [
  {
    folder: "apps/website/content/roam/welcome",
    label: "Roam welcome docs",
    mediaFolder: "apps/website/public/docs/roam",
    name: "roam_welcome_docs",
    previewPath: "docs/roam/welcome",
    publicFolder: "/docs/roam",
  },
  {
    folder: "apps/website/content/roam/guides",
    label: "Roam guides",
    mediaFolder: "apps/website/public/docs/roam",
    name: "roam_guides",
    previewPath: "docs/roam/guides",
    publicFolder: "/docs/roam",
  },
  {
    folder: "apps/website/content/roam/guides/exploring-discourse-graph",
    label: "Roam graph exploration docs",
    mediaFolder: "apps/website/public/docs/roam",
    name: "roam_graph_exploration_docs",
    previewPath: "docs/roam/guides/exploring-discourse-graph",
    publicFolder: "/docs/roam",
  },
  {
    folder: "apps/website/content/roam/fundamentals",
    label: "Roam fundamentals",
    mediaFolder: "apps/website/public/docs/roam",
    name: "roam_fundamentals",
    previewPath: "docs/roam/fundamentals",
    publicFolder: "/docs/roam",
  },
  {
    folder: "apps/website/content/roam/fundamentals/grammar",
    label: "Roam grammar docs",
    mediaFolder: "apps/website/public/docs/roam",
    name: "roam_grammar_docs",
    previewPath: "docs/roam/fundamentals/grammar",
    publicFolder: "/docs/roam",
  },
  {
    folder: "apps/website/content/roam/use-cases",
    label: "Roam use cases",
    mediaFolder: "apps/website/public/docs/roam",
    name: "roam_use_cases",
    previewPath: "docs/roam/use-cases",
    publicFolder: "/docs/roam",
  },
  {
    folder: "apps/website/content/obsidian/welcome",
    label: "Obsidian welcome docs",
    mediaFolder: "apps/website/public/docs/obsidian",
    name: "obsidian_welcome_docs",
    previewPath: "docs/obsidian/welcome",
    publicFolder: "/docs/obsidian",
  },
  {
    folder: "apps/website/content/obsidian/fundamentals",
    label: "Obsidian fundamentals",
    mediaFolder: "apps/website/public/docs/obsidian",
    name: "obsidian_fundamentals",
    previewPath: "docs/obsidian/fundamentals",
    publicFolder: "/docs/obsidian",
  },
  {
    folder: "apps/website/content/obsidian/configuration",
    label: "Obsidian configuration docs",
    mediaFolder: "apps/website/public/docs/obsidian",
    name: "obsidian_configuration_docs",
    previewPath: "docs/obsidian/configuration",
    publicFolder: "/docs/obsidian",
  },
  {
    folder: "apps/website/content/obsidian/core-features",
    label: "Obsidian core features",
    mediaFolder: "apps/website/public/docs/obsidian",
    name: "obsidian_core_features",
    previewPath: "docs/obsidian/core-features",
    publicFolder: "/docs/obsidian",
  },
  {
    folder: "apps/website/content/obsidian/advanced-features",
    label: "Obsidian advanced features",
    mediaFolder: "apps/website/public/docs/obsidian",
    name: "obsidian_advanced_features",
    previewPath: "docs/obsidian/advanced-features",
    publicFolder: "/docs/obsidian",
  },
  {
    folder: "apps/website/content/obsidian/use-cases",
    label: "Obsidian use cases",
    mediaFolder: "apps/website/public/docs/obsidian",
    name: "obsidian_use_cases",
    previewPath: "docs/obsidian/use-cases",
    publicFolder: "/docs/obsidian",
  },
];

const LANDING_PAGES: LandingPageConfig[] = [
  {
    file: "apps/website/content/index.mdx",
    label: "Docs landing page",
    name: "docs_landing_page",
    previewPath: "docs",
  },
  {
    file: "apps/website/content/roam/index.mdx",
    label: "Roam landing page",
    name: "roam_landing_page",
    previewPath: "docs/roam",
  },
  {
    file: "apps/website/content/obsidian/index.mdx",
    label: "Obsidian landing page",
    name: "obsidian_landing_page",
    previewPath: "docs/obsidian",
  },
  {
    file: "apps/website/content/blog/index.mdx",
    label: "Updates landing page",
    name: "blog_landing_page",
    previewPath: "blog",
  },
];

const PREVIEW_TEMPLATE_NAMES: string[] = [
  "blog_posts",
  ...DOCS_COLLECTIONS.map(({ name }) => name),
  ...LANDING_PAGES.map(({ name }) => name),
];

const buildPreviewableBodyField = ({
  hint,
}: {
  hint: string;
}): DecapCmsField => ({
  buttons: [
    "bold",
    "italic",
    "link",
    "quote",
    "code",
    "bulleted-list",
    "numbered-list",
  ],
  editor_components: ["image", "code-block"],
  hint,
  label: "Body",
  modes: ["raw"],
  name: "body",
  widget: "markdown",
});

const buildDocsFields = (): DecapCmsField[] => [
  {
    label: "Title",
    name: "title",
    widget: "string",
  },
  {
    date_format: "YYYY-MM-DD",
    label: "Date",
    name: "date",
    picker_utc: true,
    time_format: false,
    widget: "datetime",
  },
  {
    label: "Author",
    name: "author",
    required: false,
    widget: "string",
  },
  {
    default: true,
    label: "Published",
    name: "published",
    widget: "hidden",
  },
  buildPreviewableBodyField({ hint: DOCS_BODY_HINT }),
];

const buildLandingPageFields = (): DecapCmsField[] => [
  {
    label: "Title",
    name: "title",
    widget: "string",
  },
  {
    label: "Description",
    name: "description",
    widget: "text",
  },
  buildPreviewableBodyField({ hint: MDX_BODY_HINT }),
];

const buildDocsCollection = ({
  folder,
  label,
  mediaFolder,
  name,
  previewPath,
  publicFolder,
}: DocsCollectionConfig): DecapCmsCollection => ({
  create: false,
  editor: {
    preview: true,
  },
  extension: "md",
  fields: buildDocsFields(),
  folder,
  format: "frontmatter",
  identifier_field: "title",
  label,
  media_folder: mediaFolder,
  name,
  preview_path: `${previewPath}/{{slug}}`,
  public_folder: publicFolder,
  slug: "{{slug}}",
  sortable_fields: ["title", "commit_date"],
  summary: "{{title}}",
});

const buildLandingPageFile = ({
  file,
  label,
  name,
  previewPath,
}: LandingPageConfig): DecapCmsFile => ({
  file,
  fields: buildLandingPageFields(),
  label,
  media_folder: PAGES_MEDIA_FOLDER,
  name,
  preview_path: previewPath,
  public_folder: PAGES_PUBLIC_FOLDER,
});

const registerPreviewTemplates = (): boolean => {
  const cmsWindow = getCmsWindow();

  if (cmsWindow.__decapPreviewTemplatesRegistered) {
    return true;
  }

  if (
    typeof cmsWindow.CMS?.registerPreviewTemplate !== "function" ||
    typeof cmsWindow.createClass !== "function" ||
    typeof cmsWindow.h !== "function"
  ) {
    return false;
  }

  const previewComponent = cmsWindow.createClass({
    render(this: { props: PreviewProps }) {
      const { entry, widgetFor } = this.props;
      const title = entry.getIn?.(["data", "title"]);
      const description = entry.getIn?.(["data", "description"]);
      const author = entry.getIn?.(["data", "author"]);
      const date = entry.getIn?.(["data", "date"]);
      const metadata = [date, author].filter(Boolean).join(" | ");

      return cmsWindow.h!(
        "article",
        {
          style: {
            color: "#111827",
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            lineHeight: "1.6",
            padding: "24px",
          },
        },
        cmsWindow.h!(
          "div",
          {
            style: {
              backgroundColor: "#fffbeb",
              border: "1px solid #fcd34d",
              borderRadius: "8px",
              color: "#92400e",
              fontSize: "14px",
              marginBottom: "24px",
              padding: "12px 14px",
            },
          },
          PREVIEW_NOTICE,
        ),
        title
          ? cmsWindow.h!(
              "h1",
              {
                style: {
                  fontSize: "32px",
                  fontWeight: 700,
                  lineHeight: "1.2",
                  margin: "0 0 12px",
                },
              },
              title,
            )
          : null,
        description
          ? cmsWindow.h!(
              "p",
              {
                style: {
                  color: "#4b5563",
                  fontSize: "16px",
                  margin: "0 0 12px",
                },
              },
              description,
            )
          : null,
        metadata
          ? cmsWindow.h!(
              "p",
              {
                style: {
                  color: "#6b7280",
                  fontSize: "14px",
                  margin: "0 0 24px",
                },
              },
              metadata,
            )
          : null,
        cmsWindow.h!(
          "div",
          {
            style: {
              borderTop: "1px solid #e5e7eb",
              paddingTop: "24px",
            },
          },
          widgetFor("body"),
        ),
      );
    },
  });

  PREVIEW_TEMPLATE_NAMES.forEach((name) => {
    cmsWindow.CMS!.registerPreviewTemplate!(name, previewComponent);
  });
  cmsWindow.__decapPreviewTemplatesRegistered = true;
  return true;
};

const buildDecapConfig = ({
  oauthBaseUrl,
  siteDomain,
}: {
  oauthBaseUrl: string;
  siteDomain: string;
}): DecapCmsConfig => ({
  backend: {
    auth_endpoint: "auth",
    base_url: oauthBaseUrl,
    branch: "main",
    cms_label_prefix: "decap-cms/",
    commit_messages: {
      create: 'Create {{collection}} "{{slug}}"',
      delete: 'Delete {{collection}} "{{slug}}"',
      deleteMedia: "Delete media asset",
      openAuthoring: "{{message}}",
      update: 'Update {{collection}} "{{slug}}"',
      uploadMedia: "Upload media asset",
    },
    name: "github",
    open_authoring: true,
    repo: "DiscourseGraphs/discourse-graph",
    site_domain: siteDomain,
  },
  collections: [
    {
      create: true,
      editor: {
        preview: true,
      },
      extension: "mdx",
      fields: [
        {
          default: "blog_post",
          hint: "Used internally to keep helper files out of the editor list.",
          label: "Content type",
          name: "content_type",
          widget: "hidden",
        },
        {
          hint: "Shown on the updates index and the post page.",
          label: "Title",
          name: "title",
          widget: "string",
        },
        {
          date_format: "YYYY-MM-DD",
          hint: "Shown on the updates index and in post metadata.",
          label: "Date",
          name: "date",
          picker_utc: true,
          time_format: false,
          widget: "datetime",
        },
        {
          default: "Discourse Graphs",
          hint: "Used in the post header and metadata.",
          label: "Author",
          name: "author",
          widget: "string",
        },
        {
          hint: "Optional summary used in metadata and previews.",
          label: "Description",
          name: "description",
          required: false,
          widget: "text",
        },
        {
          field: {
            label: "Tag",
            name: "tag",
            widget: "string",
          },
          hint: "Optional labels for the post header and metadata.",
          label: "Tags",
          name: "tags",
          required: false,
          widget: "list",
        },
        {
          default: true,
          label: "Published",
          name: "published",
          widget: "hidden",
        },
        {
          buttons: [
            "bold",
            "italic",
            "link",
            "quote",
            "code",
            "bulleted-list",
            "numbered-list",
          ],
          editor_components: ["image", "code-block"],
          hint: MDX_BODY_HINT,
          label: "Body",
          modes: ["raw"],
          name: "body",
          widget: "markdown",
        },
      ],
      filter: {
        field: "content_type",
        value: "blog_post",
      },
      folder: "apps/website/content/blog",
      format: "frontmatter",
      identifier_field: "title",
      label: "Blog posts",
      label_singular: "Blog post",
      media_folder: "apps/website/public/uploads/blog",
      name: "blog_posts",
      preview_path: "blog/{{slug}}",
      public_folder: "/uploads/blog",
      slug: "{{slug}}",
      sortable_fields: ["date", "title", "commit_date"],
      summary: "{{title}} - {{date}}",
    },
    {
      editor: {
        preview: true,
      },
      extension: "mdx",
      files: LANDING_PAGES.map(buildLandingPageFile),
      format: "frontmatter",
      label: "Landing pages",
      name: "landing_pages",
    },
    ...DOCS_COLLECTIONS.map(buildDocsCollection),
  ],
  load_config_file: false,
  media_folder: "apps/website/public",
  public_folder: "/",
  publish_mode: "editorial_workflow",
  slug: {
    clean_accents: true,
    encoding: "ascii",
  },
});

const AdminShell = ({ oauthBaseUrl }: AdminShellProps): React.ReactElement => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const config = useMemo<DecapCmsConfig>(() => {
    if (typeof window === "undefined") {
      return {};
    }

    return buildDecapConfig({
      oauthBaseUrl: oauthBaseUrl || window.location.origin,
      siteDomain: window.location.hostname,
    });
  }, [oauthBaseUrl]);

  useEffect(() => {
    const tryInitializeCms = (): boolean => {
      const cmsWindow = getCmsWindow();

      if (cmsWindow.__decapCmsInitialized) {
        return true;
      }

      registerPreviewTemplates();

      if (typeof cmsWindow.initCMS !== "function") {
        return false;
      }

      try {
        cmsWindow.initCMS({ config });
        cmsWindow.__decapCmsInitialized = true;
        return true;
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to start the Decap CMS admin shell.",
        );
        return true;
      }
    };

    if (tryInitializeCms()) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (tryInitializeCms()) {
        window.clearInterval(intervalId);
      }
    }, 100);
    const timeoutId = window.setTimeout(() => {
      if (!getCmsWindow().__decapCmsInitialized) {
        window.clearInterval(intervalId);
        setErrorMessage(
          "Timed out while loading the Decap CMS script. Reload the page and try again.",
        );
      }
    }, 10_000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [config]);

  return (
    <div
      id="nc-root"
      className="min-h-screen bg-white text-gray-900"
      suppressHydrationWarning
    >
      {errorMessage ? (
        <div className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="text-2xl font-semibold">Decap CMS failed to load</h1>
          <p className="mt-3 text-sm text-gray-700">{errorMessage}</p>
          <p className="mt-6 text-sm text-gray-700">
            Confirm the Decap script is reachable and the GitHub OAuth
            environment variables are configured for this deployment.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-gray-600">
          Loading Decap CMS...
        </div>
      )}
    </div>
  );
};

export default AdminShell;
