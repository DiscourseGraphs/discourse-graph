import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { z } from "zod";

const getVersion = (): string => {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { version?: string };
    return packageJson.version || "-";
  } catch (error) {
    console.warn("Failed to read version from package.json:", error);
    return "-";
  }
};

const getBuildDate = (): string => {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
};
let envContents = null;

try {
  const dbDotEnv = require("@repo/database/dbDotEnv");
  envContents = dbDotEnv.envContents;
} catch (error) {
  if ((error as Error).message.includes("Cannot find module")) {
    console.error("Build the database module before compiling roam");
    process.exit(1);
  }
  throw error;
}

// https://github.com/evanw/esbuild/issues/337#issuecomment-954633403
const importAsGlobals = (
  mapping: Record<string, string> = {},
): esbuild.Plugin => {
  const escRe = (s: string) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const filter = new RegExp(
    Object.keys(mapping).length
      ? Object.keys(mapping)
          .map((mod) => `^${escRe(mod)}$`)
          .join("|")
      : /$^/,
  );

  return {
    name: "global-imports",
    setup(build) {
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
        async (args) => {
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

const DEFAULT_FILES_INCLUDED = ["package.json", "README.md"];

const addPlaceholderChangelogPlugin = (outdir: string): esbuild.Plugin => ({
  name: "add-changelog",
  setup(build) {
    build.onEnd(async () => {
      fs.writeFileSync(path.join(outdir, "CHANGELOG.md"), "placeholder");
    });
  },
});

const cliArgs = z.object({
  out: z.string().optional(),
  root: z.string().optional(),
  format: z.enum(["esm"]).optional(),
  external: z.array(z.string()),
});

type Builder = (opts: esbuild.BuildOptions) => Promise<void>;
export type CliOpts = Record<string, string | string[] | boolean>;

export const args = {
  out: "extension",
  format: "esm",
  root: ".",
  mirror: ".",
  external: [
    "react-dom/client=window.ReactDOM",
    "@blueprintjs/core=window.Blueprint.Core",
    "@blueprintjs/datetime=window.Blueprint.DateTime",
    "@blueprintjs/select=window.Blueprint.Select",
    "chrono-node=window.ChronoNode",
    "crypto-js=window.CryptoJS",
    "cytoscape=window.RoamLazy.Cytoscape",
    "file-saver=window.FileSaver",
    "jszip=window.RoamLazy.JSZip",
    "idb=window.idb",
    "insect=window.RoamLazy.Insect",
    "marked=window.RoamLazy.Marked",
    "marked-react=window.RoamLazy.MarkedReact",
    "nanoid=window.Nanoid;module.exports.nanoid=window.Nanoid",
    'react=window.React;module.exports.useSyncExternalStore=require("use-sync-external-store/shim").useSyncExternalStore',
    "react/jsx-runtime=./node_modules/react/jsx-runtime.js",
    "react-dom=window.ReactDOM",
    "react-youtube=window.ReactYoutube",
    "tslib=window.TSLib",
  ],
} as CliOpts;

export const compile = ({
  opts = args,
  builder = async (opts) => {
    await esbuild.build(opts);
  },
}: {
  opts?: CliOpts;
  builder?: Builder;
}) => {
  const { root = ".", out, format, external } = cliArgs.parse(opts);

  const externalModules = external.map((e) => e.split("="));
  const srcRoot = path.join(root, "src");
  const entryTs = "index.ts";
  const outdir = path.resolve(process.cwd(), root, "dist");

  fs.mkdirSync(outdir, { recursive: true });

  const buildPromises = [] as Promise<void>[];
  const dbEnv = envContents();
  buildPromises.push(
    builder({
      absWorkingDir: process.cwd(),
      entryPoints: [path.join(srcRoot, entryTs)],
      outdir,
      bundle: true,
      format,
      define: {
        "process.env.SUPABASE_USE_DB": `"${process.env.SUPABASE_USE_DB}"`,
        "process.env.SUPABASE_URL": dbEnv.SUPABASE_URL
          ? `"${dbEnv.SUPABASE_URL}"`
          : "null",
        "process.env.SUPABASE_ANON_KEY": dbEnv.SUPABASE_ANON_KEY
          ? `"${dbEnv.SUPABASE_ANON_KEY}"`
          : "null",
        "process.env.NEXT_API_ROOT": `"${dbEnv.NEXT_API_ROOT || ""}"`,
        "window.__DISCOURSE_GRAPH_VERSION__": `"${getVersion()}"`,
        "window.__DISCOURSE_GRAPH_BUILD_DATE__": `"${getBuildDate()}"`,
      },
      sourcemap: process.env.NODE_ENV === "production" ? "external" : "inline",
      minify: process.env.NODE_ENV === "production",
      entryNames: out,
      external: externalModules.map(([e]) => e).concat(["crypto"]),
      plugins: [
        importAsGlobals(
          Object.fromEntries(
            externalModules
              .filter((e) => e.length > 1)
              .map(([e, ...g]) => [e, g.join("=")]),
          ),
        ),
        {
          name: "log",
          setup: (build) => {
            build.onEnd((result) => {
              console.log(`built with ${result.errors.length} errors`);
            });
          },
        },
        addPlaceholderChangelogPlugin(outdir),
        {
          name: "onFinish",
          setup(build) {
            build.onEnd(async () => {
              DEFAULT_FILES_INCLUDED.map((f) => path.join(root, f))
                .filter((f) => fs.existsSync(f))
                .forEach((f) => {
                  fs.cpSync(f, path.join(outdir, path.basename(f)));
                });
            });
          },
        },
      ],
      loader: {
        ".woff": "file",
        ".woff2": "file",
        ".yaml": "text",
      },
    }),
  );

  return Promise.all(buildPromises);
};

const main = async () => {
  try {
    await compile({});
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
if (require.main === module) main();
