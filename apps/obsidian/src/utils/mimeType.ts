// Replaces the `mime-types` package, which requires Node's `path` module and so
// cannot load on Obsidian mobile. Only covers extensions Obsidian accepts as
// vault attachments; anything else falls back to a generic binary type.
const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  // Images
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  ico: "image/vnd.microsoft.icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",

  // Audio
  aac: "audio/aac",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  webm: "video/webm",

  // Video
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  mp4: "video/mp4",
  ogv: "video/ogg",

  // Documents
  pdf: "application/pdf",

  // Text — callers rely on the `text/` prefix to skip these
  canvas: "application/json",
  css: "text/css",
  csv: "text/csv",
  html: "text/html",
  js: "text/javascript",
  json: "application/json",
  md: "text/markdown",
  txt: "text/plain",
  xml: "text/xml",
  yaml: "text/yaml",
  yml: "text/yaml",
};

export const DEFAULT_MIME_TYPE = "application/octet-stream";

export const getMimeTypeForPath = (filePath: string): string => {
  const fileName = filePath.split("/").pop() ?? "";
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex <= 0) return DEFAULT_MIME_TYPE;
  const extension = fileName.slice(lastDotIndex + 1).toLowerCase();
  return MIME_TYPES_BY_EXTENSION[extension] ?? DEFAULT_MIME_TYPE;
};
