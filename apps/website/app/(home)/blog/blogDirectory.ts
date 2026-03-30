import path from "node:path";
import { fileURLToPath } from "node:url";

const BLOG_MODULE_PATH = fileURLToPath(import.meta.url);

export const BLOG_DIRECTORY = path.join(
  path.dirname(BLOG_MODULE_PATH),
  "posts",
);
