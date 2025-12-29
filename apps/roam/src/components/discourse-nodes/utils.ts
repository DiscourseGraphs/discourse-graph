export const getCleanTagText = (tag: string): string => {
  return tag.replace(/^#+/, "").trim().toUpperCase();
};

export const generateTagPlaceholder = (
  nodeText: string,
  format: string,
): string => {
  const referenceMatch = format.match(/\[\[([A-Z]+)\]\]/);

  if (referenceMatch) {
    const reference = referenceMatch[1].toLowerCase();
    return `#${reference.slice(0, 3)}-candidate`;
  }

  const nodeTextPrefix = nodeText.toLowerCase().slice(0, 3);
  return `#${nodeTextPrefix}-candidate`;
};

export const validateTagFormat = (
  tagValue: string,
  formatValue: string,
): { tagError: string; formatError: string } => {
  const cleanTag = getCleanTagText(tagValue);

  if (!cleanTag) {
    return { tagError: "", formatError: "" };
  }

  const roamTagRegex = /#?\[\[(.*?)\]\]|#(\S+)/g;
  const matches = formatValue.matchAll(roamTagRegex);
  const formatTags: string[] = [];
  for (const match of matches) {
    const tagName = match[1] || match[2];
    if (tagName) {
      formatTags.push(tagName.toUpperCase());
    }
  }

  const hasConflict = formatTags.includes(cleanTag);

  if (hasConflict) {
    return {
      formatError: `The format references the node's tag "${tagValue}". Please use a different format or tag.`,
      tagError: `The tag "${tagValue}" is referenced in the format. Please use a different tag or format.`,
    };
  }

  return { tagError: "", formatError: "" };
};
