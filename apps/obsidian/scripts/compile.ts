import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { z } from "zod";
import builtins from "builtin-modules";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_FILES_INCLUDED = ["manifest.json"];
const isProd = process.env.NODE_ENV === "production";

const cliArgs = z.object({
  out: z.string().optional(),
  root: z.string().optional(),
  format: z.enum(["esm", "cjs"]).optional(),
  external: z.array(z.string()),
  mirror: z.string().optional(),
});

type Builder = (opts: esbuild.BuildOptions) => Promise<void>;
export type CliOpts = Record<string, string | string[] | boolean>;

export const args = {
  out: "main",
  format: "cjs",
  root: ".",
  mirror: process.env.OBSIDIAN_PLUGIN_PATH,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
} as CliOpts;

const readDir = (directoryPath: string): string[] => {
  try {
    if (!fs.existsSync(directoryPath)) {
      console.error(`Directory does not exist: ${directoryPath}`);
      return [];
    }

    return fs
      .readdirSync(directoryPath, { withFileTypes: true })
      .flatMap((f) => {
        const fullPath = `${directoryPath}/${f.name}`;
        return f.isDirectory() ? readDir(fullPath) : [fullPath];
      });
  } catch (error) {
    console.error(`Error reading directory ${directoryPath}:`, error);
    return [];
  }
};

const appPath = (p: string): string =>
  path.resolve(fs.realpathSync(process.cwd()), p);

export const compile = ({
  opts = args,
  builder = async (opts) => {
    await esbuild.build(opts);
  },
}: {
  opts?: CliOpts;
  builder?: Builder;
}) => {
  const { root = ".", out, format, external, mirror } = cliArgs.parse(opts);

  const srcRoot = path.join(root, "src");
  const entryTs = "index.ts";
  const outdir = path.resolve(process.cwd(), root, "dist");
  const stylesDir = path.join(root, "src", "styles");
  const outputStylesFile = path.join(outdir, "styles.css");

  fs.mkdirSync(outdir, { recursive: true });

  const buildPromises = [] as Promise<void>[];
  buildPromises.push(
    builder({
      absWorkingDir: process.cwd(),
      entryPoints: [path.join(srcRoot, entryTs)],
      outdir,
      bundle: true,
      format,
      sourcemap: isProd ? undefined : "inline",
      minify: isProd,
      entryNames: out,
      external: external,
      plugins: [
        {
          name: "log",
          setup: (build) => {
            build.onEnd((result) => {
              console.log(`built with ${result.errors.length} errors`);
            });
          },
        },
        {
          name: "combineStyles",
          setup(build) {
            build.onEnd(async () => {
              const styleFiles = fs
                .readdirSync(stylesDir)
                .filter((file) => file.endsWith(".css"));
              const combinedStyles = styleFiles
                .map((file) =>
                  fs.readFileSync(path.join(stylesDir, file), "utf8"),
                )
                .join("\n");
              fs.writeFileSync(outputStylesFile, combinedStyles);
            });
          },
        },
        {
          name: "copyDefaultFiles",
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
        {
          name: "mirrorFiles",
          setup(build) {
            build.onEnd(async () => {
              if (!mirror) return;

              const normalizedMirrorPath = path.normalize(mirror);
              const resolvedMirrorPath = path.resolve(
                root,
                normalizedMirrorPath,
              );

              if (!fs.existsSync(resolvedMirrorPath)) {
                fs.mkdirSync(resolvedMirrorPath, { recursive: true });
              }

              readDir(outdir)
                .filter((file) => fs.existsSync(appPath(file)))
                .forEach((file) => {
                  const destinationPath = path.join(
                    resolvedMirrorPath,
                    path.relative(outdir, file),
                  );
                  fs.cpSync(appPath(file), destinationPath);
                });
            });
          },
        },
      ],
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
