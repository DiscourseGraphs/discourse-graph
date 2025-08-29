export type Variant =
  | "none"
  | "local"
  | "branch"
  | "production"
  | "all"
  | "implicit";
export declare const getVariant: () => Variant;
export declare const envFilePath: () => string | null;
export declare const envContents: () =>
  | EnvMap
  | {
      SUPABASE_URL: string | undefined;
      SUPABASE_ANON_KEY: string | undefined;
      NEXT_API_ROOT: string | undefined;
    };
export declare const config: () => void;
