import {
  type GenericSchema,
  type GenericFunction,
} from "@supabase/supabase-js/src/lib/types";
import {
  type Database as GenDatabase,
  type Tables,
  type TablesInsert,
  type TablesUpdate,
} from "./types.gen";

// Inspired by https://github.com/supabase/postgres-meta/issues/578#issuecomment-1955140767

type DatabaseShape = {
  [schema_name: string]: GenericSchema;
};

// Helper functions
type ChangeFields<T, R> = Omit<T, keyof R> & R; // Credits: https://stackoverflow.com/a/67884937

type ExtractFnByName<
  DBType extends DatabaseShape,
  FnName extends string,
> = DBType["public"]["Functions"][FnName];

type ChangePgFunctionType<
  DBType extends DatabaseShape,
  FnName extends string,
  FnArg extends string,
> = ChangeFields<
  DBType,
  {
    public: ChangeFields<
      DBType["public"],
      {
        Functions: ChangeFields<
          DBType["public"]["Functions"],
          Record<
            FnName,
            ReplaceVectorArg<FnArg, ExtractFnByName<DBType, FnName>>
          >
        >;
      }
    >;
  }
>;

type ReplaceVectorArg<ArgName extends string, T extends GenericFunction> = Omit<
  T,
  "Args"
> & {
  Args: Omit<T["Args"], ArgName> & Record<ArgName, number[]>;
};

// Fix database types

type TypeSafeDatabase1 = ChangePgFunctionType<
  GenDatabase,
  "match_embeddings_for_subset_nodes",
  "p_query_embedding"
>;

type Database = ChangePgFunctionType<
  TypeSafeDatabase1,
  "match_content_embeddings",
  "query_embedding"
>;

export { type Database, Tables, TablesInsert, TablesUpdate };
