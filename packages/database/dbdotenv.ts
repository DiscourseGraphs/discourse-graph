import dotenv from "dotenv";

if (process.env.HOME !== "/vercel") {
  const variant =
    (process.argv.length === 3
      ? process.argv[2]
      : process.env["SUPABASE_USE_DB"]) || "local";

  if (["local", "branch", "production"].indexOf(variant) === -1) {
    console.error("Invalid variant: " + variant);
    process.exit(-1);
  }
  dotenv.config({ path: `./.env.${variant}` });
}
