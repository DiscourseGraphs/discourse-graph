import { z } from "zod";

export const PageSchema = z.object({
  title: z.string(),
  published: z.boolean().default(false),
  date: z.string(),
  author: z.string(),
});
export type PageFrontmatter = z.infer<typeof PageSchema>;
export type PageData = PageFrontmatter & {
  slug: string;
};

export type Node = {
  type: string;
  attributes: Record<string, unknown>;
  children?: Node[];
};
export type HeadingNode = Node & {
  type: "heading";
  attributes: {
    level: 1 | 2 | 3 | 4 | 5 | 6;
    id?: string;
    [key: string]: unknown;
  };
};
export type H2Node = HeadingNode & {
  attributes: {
    level: 2;
  };
};
export type H3Node = HeadingNode & {
  attributes: {
    level: 3;
  };
};
export type Section = H2Node["attributes"] & {
  id: string;
  title: string;
  children: Array<Subsection>;
};
export type Subsection = H3Node["attributes"] & {
  id: string;
  title: string;
  children?: undefined;
};
