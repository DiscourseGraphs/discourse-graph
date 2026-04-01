import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import { createIndex, close } from "pagefind";

/**
 * @typedef {Record<string, string[]>} SearchFilters
 */

/**
 * @typedef {{
 *   url: string;
 *   content: string;
 *   meta: {
 *     title: string;
 *   };
 *   filters?: SearchFilters;
 * }} SearchRecord
 */

const CONTENT_ROOT = path.join(process.cwd(), "content");
const OUTPUT_PATH = path.join(process.cwd(), "public", "_pagefind");
const DOCS_PREFIX = "/docs";
const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx"]);
const DOC_DIRECTORIES = ["roam", "obsidian"];

/**
 * @param {string} value
 * @returns {string}
 */
const collapseWhitespace = (value) => value.replace(/\s+/g, " ").trim();

/**
 * @param {string} source
 * @returns {string}
 */
export const markdownToSearchText = (source) => {
  const withoutImports = source.replace(/^\s*(import|export)\s.+$/gm, " ");
  const withoutFences = withoutImports.replace(/```[\s\S]*?```/g, " ");
  const withoutImages = withoutFences.replace(
    /!\[([^\]]*)\]\([^)]+\)/g,
    " $1 ",
  );
  const withoutLinks = withoutImages.replace(/\[([^\]]+)\]\([^)]+\)/g, " $1 ");
  const withoutHtml = withoutLinks.replace(/<[^>]+>/g, " ");
  const withoutInlineCode = withoutHtml.replace(/`([^`]+)`/g, " $1 ");
  const withoutMarkdownTokens = withoutInlineCode
    .replace(/^#{1,6}\s*/gm, " ")
    .replace(/^\s*>+\s?/gm, " ")
    .replace(/^\s*[-*+]\s+/gm, " ")
    .replace(/^\s*\d+\.\s+/gm, " ")
    .replace(/\|/g, " ")
    .replace(/[*_~]/g, " ");

  return collapseWhitespace(withoutMarkdownTokens);
};

/**
 * @param {string} absoluteFilePath
 * @returns {string}
 */
export const routePathFromContentFile = (absoluteFilePath) => {
  const relativePath = path.relative(CONTENT_ROOT, absoluteFilePath);
  const normalizedPath = relativePath.replace(/\\/g, "/");
  const withoutExtension = normalizedPath.replace(/\.(md|mdx)$/u, "");
  const segments = withoutExtension.split("/");

  if (withoutExtension === "index") {
    return DOCS_PREFIX;
  }

  if (segments.at(-1) === "index") {
    segments.pop();
  }

  return `${DOCS_PREFIX}/${segments.join("/")}`;
};

/**
 * @param {string} absoluteFilePath
 * @returns {SearchFilters | undefined}
 */
export const searchFiltersFromContentFile = (absoluteFilePath) => {
  const relativePath = path.relative(CONTENT_ROOT, absoluteFilePath);
  const normalizedPath = relativePath.replace(/\\/g, "/");
  const [topLevelDirectory] = normalizedPath.split("/");

  if (DOC_DIRECTORIES.includes(topLevelDirectory)) {
    return {
      platform: [topLevelDirectory],
    };
  }

  return undefined;
};

/**
 * @param {string} absoluteFilePath
 * @returns {string}
 */
const titleFromFilePath = (absoluteFilePath) =>
  path
    .basename(absoluteFilePath, path.extname(absoluteFilePath))
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

/**
 * @param {string} absoluteFilePath
 * @returns {boolean}
 */
const isMarkdownFile = (absoluteFilePath) =>
  MARKDOWN_EXTENSIONS.has(path.extname(absoluteFilePath));

/**
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
const collectMarkdownFiles = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectMarkdownFiles(absolutePath);
      }

      return isMarkdownFile(absolutePath) ? [absolutePath] : [];
    }),
  );

  return nestedFiles.flat();
};

/**
 * @param {string} absoluteFilePath
 * @returns {Promise<SearchRecord | null>}
 */
const readDocRecord = async (absoluteFilePath) => {
  const rawFile = await fs.readFile(absoluteFilePath, "utf8");
  const { content, data } = matter(rawFile);

  if (data.published === false) {
    return null;
  }

  const title =
    typeof data.title === "string" && data.title.trim().length
      ? data.title.trim()
      : titleFromFilePath(absoluteFilePath);
  const searchText = markdownToSearchText(content);
  const filters = searchFiltersFromContentFile(absoluteFilePath);

  if (!searchText.length) {
    return null;
  }

  return {
    url: routePathFromContentFile(absoluteFilePath),
    content: `${title}\n${searchText}`,
    meta: {
      title,
    },
    ...(filters ? { filters } : {}),
  };
};

/**
 * @returns {Promise<SearchRecord[]>}
 */
const collectDocRecords = async () => {
  const docFiles = await Promise.all(
    DOC_DIRECTORIES.map((directory) =>
      collectMarkdownFiles(path.join(CONTENT_ROOT, directory)),
    ),
  );
  const allFiles = docFiles.flat();
  const records = await Promise.all(allFiles.map(readDocRecord));

  return records.filter((record) => record !== null);
};

/**
 * @returns {Promise<void>}
 */
const buildDocsSearchIndex = async () => {
  await fs.rm(OUTPUT_PATH, { recursive: true, force: true });

  const records = await collectDocRecords();
  const { index, errors } = await createIndex({
    forceLanguage: "en",
  });

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }

  if (!index) {
    throw new Error("Pagefind did not return an index instance.");
  }

  for (const record of records) {
    const { errors: recordErrors } = await index.addCustomRecord({
      ...record,
      language: "en",
    });

    if (recordErrors.length) {
      throw new Error(recordErrors.join("\n"));
    }
  }

  const { errors: writeErrors } = await index.writeFiles({
    outputPath: OUTPUT_PATH,
  });

  if (writeErrors.length) {
    throw new Error(writeErrors.join("\n"));
  }

  console.log(`Indexed ${records.length} docs pages into ${OUTPUT_PATH}`);
};

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  void buildDocsSearchIndex()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => {
      void close();
    });
}
