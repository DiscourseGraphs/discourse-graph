import { vi } from "vitest";

export class TFile {
  path = "";
  stat = { ctime: 0, mtime: 0, size: 0 };
  get basename(): string {
    return this.path.split("/").pop()!.replace(/\.md$/, "");
  }
  get name(): string {
    return this.path.split("/").pop()!;
  }
  get extension(): string {
    return this.path.split(".").pop()!;
  }
}
export const Notice = vi.fn();
export const normalizePath = (path: string): string => path;
export class App {}
export class Plugin {}
export const prepareFuzzySearch = vi.fn();
