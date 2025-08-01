import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

declare const process: { env: Record<string, any> };

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
