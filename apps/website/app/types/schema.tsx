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
