import { z } from "zod";

export const SITE_URL = "https://discoursegraphs.com";

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const AbsoluteHttpUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      const protocol = new URL(value).protocol;

      return protocol === "http:" || protocol === "https:";
    },
    { message: "Expected an absolute HTTP URL" },
  );

const OrganizationSchema = z.object({
  "@type": z.literal("Organization"),
  "@id": AbsoluteHttpUrlSchema,
  name: z.string().min(1),
  url: AbsoluteHttpUrlSchema,
  logo: AbsoluteHttpUrlSchema,
  sameAs: z.array(AbsoluteHttpUrlSchema).min(1),
});

const WebSiteSchema = z.object({
  "@type": z.literal("WebSite"),
  "@id": AbsoluteHttpUrlSchema,
  name: z.string().min(1),
  url: AbsoluteHttpUrlSchema,
  description: z.string().min(1),
  publisher: z.object({ "@id": AbsoluteHttpUrlSchema }),
});

const PersonSchema = z.object({
  "@type": z.literal("Person"),
  name: z.string().min(1),
  jobTitle: z.string().min(1),
  image: AbsoluteHttpUrlSchema,
});

const ArticleSchema = z.object({
  "@type": z.literal("Article"),
  headline: z.string().min(1),
  datePublished: z.string().date(),
  author: z.object({
    "@type": z.literal("Person"),
    name: z.string().min(1),
  }),
  publisher: z.object({ "@id": AbsoluteHttpUrlSchema }),
  mainEntityOfPage: AbsoluteHttpUrlSchema,
  url: AbsoluteHttpUrlSchema,
  description: z.string().min(1).optional(),
  keywords: z.array(z.string().min(1)).optional(),
});

const BreadcrumbListSchema = z.object({
  "@type": z.literal("BreadcrumbList"),
  itemListElement: z
    .array(
      z.object({
        "@type": z.literal("ListItem"),
        position: z.number().int().positive(),
        name: z.string().min(1),
        item: AbsoluteHttpUrlSchema,
      }),
    )
    .min(1),
});

const VideoObjectSchema = z.object({
  "@type": z.literal("VideoObject"),
  name: z.string().min(1),
  description: z.string().min(1),
  embedUrl: AbsoluteHttpUrlSchema,
  thumbnailUrl: AbsoluteHttpUrlSchema,
});

const StructuredDataNodeSchema = z.discriminatedUnion("@type", [
  OrganizationSchema,
  WebSiteSchema,
  PersonSchema,
  ArticleSchema,
  BreadcrumbListSchema,
  VideoObjectSchema,
]);

const StructuredDataDocumentSchema = z.object({
  "@context": z.literal("https://schema.org"),
  "@graph": z.array(StructuredDataNodeSchema).min(1),
});

export type StructuredDataNode = z.infer<typeof StructuredDataNodeSchema>;
export type StructuredDataDocument = z.infer<
  typeof StructuredDataDocumentSchema
>;

const absoluteUrl = (path: string): string => new URL(path, SITE_URL).href;

export const createStructuredDataDocument = (
  nodes: StructuredDataNode[],
): StructuredDataDocument =>
  StructuredDataDocumentSchema.parse({
    "@context": "https://schema.org",
    "@graph": nodes,
  });

export const createSiteStructuredData = ({
  description,
}: {
  description: string;
}): StructuredDataDocument =>
  createStructuredDataDocument([
    OrganizationSchema.parse({
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: "Discourse Graphs",
      url: SITE_URL,
      logo: absoluteUrl("/DG-lockup.svg"),
      sameAs: ["https://github.com/DiscourseGraphs"],
    }),
    WebSiteSchema.parse({
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      name: "Discourse Graphs",
      url: SITE_URL,
      description,
      publisher: { "@id": ORGANIZATION_ID },
    }),
  ]);

export const createPersonStructuredData = ({
  image,
  name,
  title,
}: {
  image: string;
  name: string;
  title: string;
}): StructuredDataNode =>
  PersonSchema.parse({
    "@type": "Person",
    name,
    jobTitle: title,
    image: absoluteUrl(image),
  });

export const createVideoStructuredData = ({
  embedUrl,
  speakers,
  thumbnailUrl,
  title,
}: {
  embedUrl: string;
  speakers: string;
  thumbnailUrl: string;
  title: string;
}): StructuredDataNode =>
  VideoObjectSchema.parse({
    "@type": "VideoObject",
    name: title,
    description: `${title}. Speakers: ${speakers}.`,
    embedUrl,
    thumbnailUrl,
  });

export const createArticleStructuredData = ({
  author,
  datePublished,
  description,
  keywords,
  path,
  title,
}: {
  author: string;
  datePublished: string;
  description?: string;
  keywords: string[];
  path: string;
  title: string;
}): StructuredDataNode => {
  const url = absoluteUrl(path);

  return ArticleSchema.parse({
    "@type": "Article",
    headline: title,
    datePublished,
    author: { "@type": "Person", name: author },
    publisher: { "@id": ORGANIZATION_ID },
    mainEntityOfPage: url,
    url,
    description,
    keywords: keywords.length ? keywords : undefined,
  });
};

export const createBreadcrumbStructuredData = (
  items: Array<{ name: string; path: string }>,
): StructuredDataNode =>
  BreadcrumbListSchema.parse({
    "@type": "BreadcrumbList",
    itemListElement: items.map(({ name, path }, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: absoluteUrl(path),
    })),
  });

const getPathLabel = (segment: string): string =>
  segment
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");

export const createDocsBreadcrumbStructuredData = ({
  mdxPath,
  platform,
  title,
}: {
  mdxPath?: string[];
  platform: "obsidian" | "roam";
  title: string;
}): StructuredDataNode => {
  const platformPath = `/docs/${platform}`;
  const pathSegments = mdxPath ?? [];
  const nestedItems = pathSegments.map((segment, index) => ({
    name: index === pathSegments.length - 1 ? title : getPathLabel(segment),
    path: `${platformPath}/${pathSegments.slice(0, index + 1).join("/")}`,
  }));

  return createBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "Documentation", path: "/docs" },
    {
      name: pathSegments.length ? getPathLabel(platform) : title,
      path: platformPath,
    },
    ...nestedItems,
  ]);
};
