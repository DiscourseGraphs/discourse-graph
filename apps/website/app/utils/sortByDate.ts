export const sortByDateDesc = <T extends { date: string }>(
  left: T,
  right: T,
): number => new Date(right.date).getTime() - new Date(left.date).getTime();
