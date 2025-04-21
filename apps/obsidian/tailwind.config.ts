import type { Config } from "tailwindcss";

const config: Pick<Config, "content" | "presets"> = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
};

export default config;
