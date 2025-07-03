import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

declare const process: { env: Record<string, any> };

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const spaceAnonUserEmail = (platform: string, space_id: number) =>
  `${platform.toLowerCase()}-${space_id}-anon@database.discoursegraphs.com`;

export const IS_DEV = process.env.NODE_ENV !== "production";

export const nextApiRoot = (): string => {
  if (
    process.env.NEXT_API_ROOT !== undefined &&
    process.env.NEXT_API_ROOT !== ""
  )
    return process.env.NEXT_API_ROOT;
  return IS_DEV
    ? "http://localhost:3000/api"
    : "https://discoursegraphs.com/api";
};
