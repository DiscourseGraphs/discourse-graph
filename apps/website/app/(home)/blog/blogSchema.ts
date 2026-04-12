import { z } from "zod";

const BlogTagsSchema = z
  .union([z.array(z.string()), z.string()])
  .transform((value) => (Array.isArray(value) ? value : [value]));

export const BlogFrontmatterSchema = z.object({
  title: z.string(),
  published: z.boolean().default(false),
  date: z.string(),
  author: z.string(),
  description: z.string().optional(),
  tags: BlogTagsSchema.optional().default([]),
});

export type BlogFrontmatter = z.infer<typeof BlogFrontmatterSchema>;
export type BlogData = BlogFrontmatter & {
  slug: string;
};
