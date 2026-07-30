export type TextRange = {
  start: number;
  end: number;
};

export const isValidTextRange = ({ start, end }: TextRange): boolean =>
  Number.isInteger(start) &&
  Number.isInteger(end) &&
  start >= 0 &&
  end >= start;
