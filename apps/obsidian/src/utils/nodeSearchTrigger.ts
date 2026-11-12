/**
 * Where a just-typed trigger starts, or null. Like Roam, it must start the line
 * or follow whitespace, so `me@lab.org` doesn't open the menu.
 */
export const getTypedTriggerStart = ({
  lineBeforeCursor,
  trigger,
}: {
  lineBeforeCursor: string;
  trigger: string;
}): number | null => {
  if (!trigger || !lineBeforeCursor.endsWith(trigger)) return null;
  const start = lineBeforeCursor.length - trigger.length;
  const charBefore = lineBeforeCursor.charAt(start - 1);
  return start === 0 || /\s/.test(charBefore) ? start : null;
};

// Matches Roam's limit for the same setting.
export const MAX_NODE_SEARCH_TRIGGER_LENGTH = 5;

/** Returns an error message, or null when the trigger can be saved. */
export const validateNodeSearchTrigger = ({
  value,
  nodeTagHotkey,
}: {
  value: string;
  nodeTagHotkey: string;
}): string | null => {
  if (value.length > MAX_NODE_SEARCH_TRIGGER_LENGTH) {
    return `The trigger can be at most ${MAX_NODE_SEARCH_TRIGGER_LENGTH} characters.`;
  }
  // The node tag hotkey's keydown handler swallows the key, so it could never be typed.
  if (nodeTagHotkey && value.includes(nodeTagHotkey)) {
    return `The trigger can't contain the node tag hotkey (${nodeTagHotkey}).`;
  }
  return null;
};
