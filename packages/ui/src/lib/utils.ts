import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const spaceAnonUserEmail = (platform: string, space_id: number) =>
  `${platform.toLowerCase()}-${space_id}-anon@database.discoursegraphs.com`;
