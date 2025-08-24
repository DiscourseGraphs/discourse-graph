import esbuild from "esbuild";
import dotenv from "dotenv";
import { compile, args } from "./compile";

dotenv.config();

const dev = () => {
  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  return new Promise<number>((resolve) => {
    compile({
      opts: args,
      builder: async (opts: esbuild.BuildOptions) => {
        const esb = await esbuild.context(opts);
        esb.watch();
        // Cleanup on process termination
        const cleanup = () => {
          esb.dispose();
          resolve(0);
        };
        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);
      },
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
if (require.main === module) main();
