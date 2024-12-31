import esbuild from "esbuild";
import dotenv from "dotenv";
import { compile, args } from "./compile";

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

if (require.main === module) {
  dev().catch(console.error);
}
