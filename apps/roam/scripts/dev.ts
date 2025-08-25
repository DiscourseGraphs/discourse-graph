import esbuild from "esbuild";
import dotenv from "dotenv";
import { compile, args } from "./compile";
import { pathToFileURL } from "url";

dotenv.config();

const dev = () => {
  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  return new Promise<number>((resolve) => {
    compile({
      opts: args,
      builder: (opts: esbuild.BuildOptions) =>
        esbuild.context(opts).then((esb) => esb.watch()),
    });
    process.on("exit", resolve);
  });
};

const main = async () => {
  try {
    await dev();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
