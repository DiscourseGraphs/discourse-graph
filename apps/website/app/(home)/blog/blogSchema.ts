import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/naming-convention
const BlogTagsSchema = z
  .union([z.array(z.string()), z.string()])
  .transform((value) => (Array.isArray(value) ? value : [value]));

// eslint-disable-next-line @typescript-eslint/naming-convention
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
