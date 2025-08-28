import dotenv from "dotenv";
export declare const getVariant: () => string | null;
export declare const envFilePath: () => string | null;
export declare const envContents: () => dotenv.DotenvParseOutput | {
    SUPABASE_URL: string | undefined;
    SUPABASE_ANON_KEY: string | undefined;
    NEXT_API_ROOT: string | undefined;
};
export declare const config: () => void;
