// Roam embed syntax: {{[[embed]]: ((block-uid)) }}
// Roam embed syntax: {{[[embed-path]]: ((block-uid)) }}
// Also handles multiple parentheses: {{[[embed]]: ((((block-uid)))) }}
export const EMBED_REGEX =
  /{{\[\[(?:embed|embed-path)\]\]:\s*\(\(+\s*([\w\d-]{9,10})\s*\)\)+\s*}}/;

// Roam embed-children syntax: {{[[embed-children]]: ((block-uid)) }}
export const EMBED_CHILDREN_REGEX =
  /{{\[\[embed-children\]\]:\s*\(\(+\s*([\w\d-]{9,10})\s*\)\)+\s*}}/;

// Simple block reference pattern: ((uid))
export const SIMPLE_BLOCK_REF_REGEX = /\(\(+\s*([\w\d-]{9,10})\s*\)\)+/g;

// Combined pattern to match any embed or block reference
export const ALL_EMBED_PATTERNS = [
  EMBED_REGEX,
  EMBED_CHILDREN_REGEX,
  SIMPLE_BLOCK_REF_REGEX,
];