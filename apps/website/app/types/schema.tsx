import { z } from "zod";

export const DocumentSchema = z.object({
  title: z.string(),
  published: z.boolean().default(false),
});

export const BlogSchema = DocumentSchema.extend({
  date: z.string(),
  author: z.string(),
});

export type DocumentFrontmatter = z.infer<typeof DocumentSchema>;
export type BlogFrontmatter = z.infer<typeof BlogSchema>;

export type Blog = BlogFrontmatter & {
  slug: string;
};
