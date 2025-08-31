export type Variant =
  | "none"
  | "local"
  | "branch"
  | "production"
  | "all"
  | "implicit";
export declare const getVariant: () => Variant;
export declare const envFilePath: () => string | null;
export declare const envContents: () => Record<string, string>;
export declare const config: () => void;
