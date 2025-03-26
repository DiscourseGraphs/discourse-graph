import { compile } from "./compile";

const build = async () => {
  process.env = {
    ...process.env,
    NODE_ENV: "development",
  };

  console.log("Compiling ...");
  try {
    await compile({});
    console.log("Compiling complete");
  } catch (error) {
    console.error("Build failed on compile:", error);
    process.exit(1);
  }
};

const main = async () => {
  try {
    await build();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
if (require.main === module) main();
