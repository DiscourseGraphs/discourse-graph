export const setCaretToEnd = (field: HTMLElement): void => {
  const selection = field.ownerDocument.getSelection();
  if (!selection) return;
  const range = field.ownerDocument.createRange();
  range.selectNodeContents(field);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};
