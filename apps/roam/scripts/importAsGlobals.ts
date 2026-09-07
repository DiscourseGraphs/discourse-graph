import esbuild from "esbuild";
import fs from "fs";
import path from "path";

// https://github.com/evanw/esbuild/issues/337#issuecomment-954633403
export const importAsGlobals = (
  mapping: Record<string, string> = {},
): esbuild.Plugin => {
  const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = new RegExp(
    Object.keys(mapping).length
      ? Object.keys(mapping)
          .map((mod) => `^${escRe(mod)}$`)
          .join("|")
      : /$^/,
  );

  return {
    name: "global-imports",
    setup: (build): void => {
      build.onResolve({ filter }, (args) => {
        if (!mapping[args.path]) {
          throw new Error("Unknown global: " + args.path);
        }
        return {
          path: args.path,
          namespace: "external-global",
        };
      });

      build.onLoad(
        {
          filter,
          namespace: "external-global",
        },
        (args) => {
          const global = mapping[args.path];
          if (fs.existsSync(global)) {
            return {
              contents: fs.readFileSync(global).toString(),
              loader: "js",
              resolveDir: path.dirname(global),
            };
          }
          return {
            contents: `module.exports = ${global};`,
            loader: "js",
            resolveDir: process.cwd(),
          };
        },
      );
    },
  };
};
