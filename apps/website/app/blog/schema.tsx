import { z } from "zod";

export const BlogSchema = z.object({
  title: z.string(),
  date: z.string(),
  author: z.string(),
});

export type BlogFrontmatter = z.infer<typeof BlogSchema>;

export type Blog = BlogFrontmatter & {
  slug: string;
};

